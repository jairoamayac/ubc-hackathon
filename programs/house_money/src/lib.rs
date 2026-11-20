//! House Money: group savings pots ("crews") on Solana.
//!
//! Invariants (tested in tests/ and checked on devnet):
//! 1. Principal is protected: a member can only put at risk the yield their shares earned
//!    (value - principal). `open_call` rejects any stake above that.
//! 2. Shares are the only claim on a crew vault: value = shares * vault / total_shares.
//! 3. Yield is paid from a funded yield reserve, never from another crew or member.
//! 4. A call (tryhard mode) is settled with the Pyth SOL/USD price: result = stake * boost * move.
//!    Knockout when result <= -stake; wins are capped at `max_win_multiple` x stake.
//! 5. Every token movement is signed by a PDA (config or crew); no admin can move member funds.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

pub mod social;
pub use social::*;

declare_id!("9iBNS61WwCQdZAhBntKE3vwhyQBYqyo1UGDvZDVjd6Ht");

/// Pyth Solana Receiver program (owner of PriceUpdateV2 accounts).
pub const PYTH_RECEIVER: Pubkey = pubkey!("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");
pub const SECONDS_PER_YEAR: u128 = 31_536_000;
pub const BPS: u128 = 10_000;
/// Virtual shares/assets that make the first-depositor inflation attack unprofitable.
pub const VIRTUAL_SHARES: u128 = 1_000;
pub const VIRTUAL_ASSETS: u128 = 1;
pub const MAX_NAME_LEN: usize = 32;

#[program]
pub mod house_money {
    use super::*;

    /// One-time setup: the stable-dollar mint, the yield rate and the tryhard rules.
    pub fn init_config(ctx: Context<InitConfig>, args: ConfigArgs) -> Result<()> {
        args.validate()?;
        let c = &mut ctx.accounts.config;
        c.admin = ctx.accounts.admin.key();
        c.mint = ctx.accounts.mint.key();
        c.price_feed = ctx.accounts.price_feed.key();
        c.apy_bps = args.apy_bps;
        c.time_warp = args.time_warp;
        c.call_duration = args.call_duration;
        c.max_boost = args.max_boost;
        c.max_win_multiple = args.max_win_multiple;
        c.max_price_age = args.max_price_age;
        c.bump = ctx.bumps.config;
        c.yield_vault_bump = ctx.bumps.yield_vault;
        c.house_vault_bump = ctx.bumps.house_vault;
        Ok(())
    }

    /// Admin can tune the demo knobs (rate, time warp, call length). Never touches funds.
    pub fn update_config(ctx: Context<UpdateConfig>, args: ConfigArgs) -> Result<()> {
        args.validate()?;
        let c = &mut ctx.accounts.config;
        c.apy_bps = args.apy_bps;
        c.time_warp = args.time_warp;
        c.call_duration = args.call_duration;
        c.max_boost = args.max_boost;
        c.max_win_multiple = args.max_win_multiple;
        c.max_price_age = args.max_price_age;
        Ok(())
    }

    /// Anyone can create a crew (a group pot of friends). The creator becomes its first member.
    pub fn create_crew(ctx: Context<CreateCrew>, crew_id: u64, name: String, emoji: String) -> Result<()> {
        require!(!name.trim().is_empty() && name.len() <= MAX_NAME_LEN, HmError::BadName);
        require!(emoji.len() <= 8, HmError::BadName);
        let now = Clock::get()?.unix_timestamp;
        let crew = &mut ctx.accounts.crew;
        crew.creator = ctx.accounts.owner.key();
        crew.crew_id = crew_id;
        crew.name = name;
        crew.emoji = emoji;
        crew.total_shares = 0;
        crew.total_principal = 0;
        crew.yield_paid = 0;
        crew.members = 1;
        crew.created_at = now;
        crew.last_accrual = now;
        crew.bump = ctx.bumps.crew;
        crew.vault_bump = ctx.bumps.crew_vault;
        init_member(&mut ctx.accounts.member, crew.key(), ctx.accounts.owner.key(), now, ctx.bumps.member);
        emit!(CrewCreated { crew: crew.key(), creator: crew.creator, name: crew.name.clone() });
        Ok(())
    }

    /// Join an existing crew (one member account per person per crew).
    pub fn join_crew(ctx: Context<JoinCrew>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let crew = &mut ctx.accounts.crew;
        crew.members = crew.members.checked_add(1).ok_or(HmError::MathOverflow)?;
        init_member(&mut ctx.accounts.member, crew.key(), ctx.accounts.owner.key(), now, ctx.bumps.member);
        Ok(())
    }

    /// Pays the crew the yield earned since the last accrual, from the yield reserve. Permissionless.
    pub fn accrue(ctx: Context<Accrue>) -> Result<()> {
        accrue_crew(
            &ctx.accounts.config,
            &mut ctx.accounts.crew,
            &ctx.accounts.yield_vault,
            &ctx.accounts.crew_vault,
            &ctx.accounts.mint,
            &ctx.accounts.token_program,
        )
    }

    /// Send dollars from your account into a crew. Mints shares at the current share price.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, HmError::ZeroAmount);
        accrue_crew(
            &ctx.accounts.config,
            &mut ctx.accounts.crew,
            &ctx.accounts.yield_vault,
            &ctx.accounts.crew_vault,
            &ctx.accounts.mint,
            &ctx.accounts.token_program,
        )?;
        ctx.accounts.crew_vault.reload()?;
        let shares = shares_for_assets(amount, ctx.accounts.crew.total_shares, ctx.accounts.crew_vault.amount, false)?;
        require!(shares > 0, HmError::ZeroAmount);

        token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.owner_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.crew_vault.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        let crew = &mut ctx.accounts.crew;
        let m = &mut ctx.accounts.member;
        m.shares = m.shares.checked_add(shares).ok_or(HmError::MathOverflow)?;
        m.principal = m.principal.checked_add(amount).ok_or(HmError::MathOverflow)?;
        crew.total_shares = crew.total_shares.checked_add(shares).ok_or(HmError::MathOverflow)?;
        crew.total_principal = crew.total_principal.checked_add(amount).ok_or(HmError::MathOverflow)?;
        emit!(Deposited { crew: crew.key(), owner: m.owner, amount, shares });
        Ok(())
    }

    /// Take money out of a crew. Burns shares; principal is reduced pro rata.
    pub fn withdraw(ctx: Context<Withdraw>, shares: u64) -> Result<()> {
        require!(shares > 0 && shares <= ctx.accounts.member.shares, HmError::NotEnoughShares);
        require!(ctx.accounts.member.open_call == false, HmError::CallOpen);
        accrue_crew(
            &ctx.accounts.config,
            &mut ctx.accounts.crew,
            &ctx.accounts.yield_vault,
            &ctx.accounts.crew_vault,
            &ctx.accounts.mint,
            &ctx.accounts.token_program,
        )?;
        ctx.accounts.crew_vault.reload()?;
        let amount = assets_for_shares(shares, ctx.accounts.crew.total_shares, ctx.accounts.crew_vault.amount)?;
        let m = &mut ctx.accounts.member;
        let principal_out = mul_div(m.principal as u128, shares as u128, m.shares as u128)?;

        let crew_key = ctx.accounts.crew.key();
        let creator = ctx.accounts.crew.creator;
        let id = ctx.accounts.crew.crew_id.to_le_bytes();
        let bump = [ctx.accounts.crew.bump];
        let seeds: &[&[u8]] = &[b"crew", creator.as_ref(), &id, &bump];
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.crew_vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.owner_token.to_account_info(),
                    authority: ctx.accounts.crew.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        m.shares -= shares;
        m.principal -= principal_out;
        let crew = &mut ctx.accounts.crew;
        crew.total_shares -= shares;
        crew.total_principal = crew.total_principal.saturating_sub(principal_out);
        emit!(Withdrew { crew: crew_key, owner: m.owner, amount, shares });
        Ok(())
    }

    /// Tryhard mode: call SOL up or down until `expires_at`, staking only your yield.
    pub fn open_call(ctx: Context<OpenCall>, direction: u8, boost: u8, stake: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(direction <= 1, HmError::BadDirection);
        require!(boost >= 1 && boost <= cfg.max_boost, HmError::BadBoost);
        require!(stake > 0, HmError::ZeroAmount);
        require!(!ctx.accounts.member.open_call, HmError::CallOpen);
        accrue_crew(
            cfg,
            &mut ctx.accounts.crew,
            &ctx.accounts.yield_vault,
            &ctx.accounts.crew_vault,
            &ctx.accounts.mint,
            &ctx.accounts.token_program,
        )?;
        ctx.accounts.crew_vault.reload()?;

        // Invariant 1: only the yield (value above principal) can be staked.
        let vault = ctx.accounts.crew_vault.amount;
        let total = ctx.accounts.crew.total_shares;
        let value = assets_for_shares(ctx.accounts.member.shares, total, vault)?;
        let playable = value.saturating_sub(ctx.accounts.member.principal);
        require!(stake <= playable, HmError::PrincipalIsProtected);
        let burn = shares_for_assets(stake, total, vault, true)?.min(ctx.accounts.member.shares);

        let now = Clock::get()?.unix_timestamp;
        let price = read_pyth(&ctx.accounts.price_feed, cfg, now)?;

        let creator = ctx.accounts.crew.creator;
        let id = ctx.accounts.crew.crew_id.to_le_bytes();
        let bump = [ctx.accounts.crew.bump];
        let seeds: &[&[u8]] = &[b"crew", creator.as_ref(), &id, &bump];
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.crew_vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.house_vault.to_account_info(),
                    authority: ctx.accounts.crew.to_account_info(),
                },
                &[seeds],
            ),
            stake,
            ctx.accounts.mint.decimals,
        )?;

        let m = &mut ctx.accounts.member;
        m.shares -= burn;
        m.open_call = true;
        ctx.accounts.crew.total_shares -= burn;

        let call = &mut ctx.accounts.call;
        call.member = m.key();
        call.crew = ctx.accounts.crew.key();
        call.owner = m.owner;
        call.direction = direction;
        call.boost = boost;
        call.stake = stake;
        call.entry_price = price.price;
        call.expo = price.expo;
        call.opened_at = now;
        call.expires_at = now + cfg.call_duration;
        call.bump = ctx.bumps.call;
        emit!(CallOpened { member: m.key(), direction, boost, stake, entry_price: price.price, expires_at: call.expires_at });
        Ok(())
    }

    /// Settles a call with the current Pyth price. Payout goes back into the crew as new shares.
    pub fn settle_call(ctx: Context<SettleCall>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        let now = Clock::get()?.unix_timestamp;
        require!(now >= ctx.accounts.call.expires_at, HmError::CallNotExpired);
        let exit = read_pyth(&ctx.accounts.price_feed, cfg, now)?;
        let call = &ctx.accounts.call;
        require!(exit.expo == call.expo, HmError::StalePrice);
        let payout = settle_payout(call.stake, call.boost, call.direction, call.entry_price, exit.price, cfg.max_win_multiple)?;
        let payout = payout.min(ctx.accounts.house_vault.amount);

        accrue_crew(
            cfg,
            &mut ctx.accounts.crew,
            &ctx.accounts.yield_vault,
            &ctx.accounts.crew_vault,
            &ctx.accounts.mint,
            &ctx.accounts.token_program,
        )?;
        ctx.accounts.crew_vault.reload()?;

        let mut minted = 0u64;
        if payout > 0 {
            minted = shares_for_assets(payout, ctx.accounts.crew.total_shares, ctx.accounts.crew_vault.amount, false)?;
            let bump = [cfg.bump];
            let seeds: &[&[u8]] = &[b"config", &bump];
            token_interface::transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    TransferChecked {
                        from: ctx.accounts.house_vault.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        to: ctx.accounts.crew_vault.to_account_info(),
                        authority: ctx.accounts.config.to_account_info(),
                    },
                    &[seeds],
                ),
                payout,
                ctx.accounts.mint.decimals,
            )?;
        }
        let m = &mut ctx.accounts.member;
        m.shares = m.shares.checked_add(minted).ok_or(HmError::MathOverflow)?;
        m.open_call = false;
        m.calls_played = m.calls_played.saturating_add(1);
        if payout > ctx.accounts.call.stake {
            m.calls_won = m.calls_won.saturating_add(1);
        }
        ctx.accounts.crew.total_shares = ctx.accounts.crew.total_shares.checked_add(minted).ok_or(HmError::MathOverflow)?;
        emit!(CallSettled { member: m.key(), exit_price: exit.price, stake: ctx.accounts.call.stake, payout });
        Ok(())
    }

    // ------------------------------------------------------------ social layer (see social.rs)

    /// Display name shown to the crew (people never see addresses).
    pub fn set_profile(ctx: Context<SetProfile>, name: String) -> Result<()> {
        social::set_profile_handler(ctx, name)
    }

    /// A yes/no bet about a real-life moment ("¿Alex llega al vuelo?"). `subject` can't vote.
    pub fn create_bet(ctx: Context<CreateBet>, bet_id: u64, question: String, subject: Pubkey, closes_at: i64) -> Result<()> {
        social::create_bet_handler(ctx, bet_id, question, subject, closes_at)
    }

    /// Lock crew shares on a side until the crew decides. One position per person per bet.
    pub fn place_bet(ctx: Context<PlaceBet>, side: u8, shares: u64) -> Result<()> {
        social::place_bet_handler(ctx, side, shares)
    }

    /// The crew votes what happened; a strict majority settles it.
    pub fn vote_bet(ctx: Context<VoteBet>, choice: u8) -> Result<()> {
        social::vote_bet_handler(ctx, choice)
    }

    /// Winners take their stake plus a pro-rata share of the losers' stakes.
    pub fn claim_bet(ctx: Context<ClaimBet>) -> Result<()> {
        social::claim_bet_handler(ctx)
    }

    /// A challenge with a stake per person: whoever fails pays the ones who complete it.
    pub fn create_challenge(ctx: Context<CreateChallenge>, challenge_id: u64, title: String, stake: u64, ends_at: i64) -> Result<()> {
        social::create_challenge_handler(ctx, challenge_id, title, stake, ends_at)
    }

    pub fn join_challenge(ctx: Context<JoinChallenge>) -> Result<()> {
        social::join_challenge_handler(ctx)
    }

    /// The crew votes whether each participant completed the challenge (not on their own entry).
    pub fn vote_entry(ctx: Context<VoteEntry>, passed: bool) -> Result<()> {
        social::vote_entry_handler(ctx, passed)
    }

    pub fn claim_challenge(ctx: Context<ClaimChallenge>) -> Result<()> {
        social::claim_challenge_handler(ctx)
    }
}

// ---------------------------------------------------------------- helpers

fn init_member(m: &mut Member, crew: Pubkey, owner: Pubkey, now: i64, bump: u8) {
    m.crew = crew;
    m.owner = owner;
    m.shares = 0;
    m.principal = 0;
    m.open_call = false;
    m.calls_played = 0;
    m.calls_won = 0;
    m.joined_at = now;
    m.bump = bump;
}

/// Simple interest on the crew's principal since `last_accrual`, sped up by `time_warp` for demos.
pub fn interest_due(principal: u64, apy_bps: u16, elapsed: i64, time_warp: u32) -> Result<u64> {
    if elapsed <= 0 || principal == 0 {
        return Ok(0);
    }
    let v = (principal as u128)
        .checked_mul(apy_bps as u128)
        .and_then(|x| x.checked_mul(elapsed as u128))
        .and_then(|x| x.checked_mul(time_warp as u128))
        .ok_or(HmError::MathOverflow)?
        / (BPS * SECONDS_PER_YEAR);
    u64::try_from(v).map_err(|_| HmError::MathOverflow.into())
}

fn accrue_crew<'info>(
    cfg: &Account<'info, Config>,
    crew: &mut Account<'info, Crew>,
    yield_vault: &InterfaceAccount<'info, TokenAccount>,
    crew_vault: &InterfaceAccount<'info, TokenAccount>,
    mint: &InterfaceAccount<'info, Mint>,
    token_program: &Interface<'info, TokenInterface>,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let due = interest_due(crew.total_principal, cfg.apy_bps, now - crew.last_accrual, cfg.time_warp)?;
    let pay = due.min(yield_vault.amount);
    // Only move the clock when something was paid, so tiny balances still accrue over time.
    if pay == 0 {
        if crew.total_principal == 0 {
            crew.last_accrual = now;
        }
        return Ok(());
    }
    let bump = [cfg.bump];
    let seeds: &[&[u8]] = &[b"config", &bump];
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            token_program.key(),
            TransferChecked {
                from: yield_vault.to_account_info(),
                mint: mint.to_account_info(),
                to: crew_vault.to_account_info(),
                authority: cfg.to_account_info(),
            },
            &[seeds],
        ),
        pay,
        mint.decimals,
    )?;
    crew.yield_paid = crew.yield_paid.saturating_add(pay);
    crew.last_accrual = now;
    emit!(Accrued { crew: crew.key(), amount: pay });
    Ok(())
}

pub fn mul_div(a: u128, b: u128, c: u128) -> Result<u64> {
    require!(c > 0, HmError::MathOverflow);
    let v = a.checked_mul(b).ok_or(HmError::MathOverflow)? / c;
    u64::try_from(v).map_err(|_| HmError::MathOverflow.into())
}

/// Shares for `assets` at the current price (virtual offset defends against inflation attacks).
pub fn shares_for_assets(assets: u64, total_shares: u64, vault: u64, round_up: bool) -> Result<u64> {
    let num = (assets as u128).checked_mul(total_shares as u128 + VIRTUAL_SHARES).ok_or(HmError::MathOverflow)?;
    let den = vault as u128 + VIRTUAL_ASSETS;
    let v = if round_up { num.div_ceil(den) } else { num / den };
    u64::try_from(v).map_err(|_| HmError::MathOverflow.into())
}

pub fn assets_for_shares(shares: u64, total_shares: u64, vault: u64) -> Result<u64> {
    mul_div(shares as u128, vault as u128 + VIRTUAL_ASSETS, total_shares as u128 + VIRTUAL_SHARES)
}

/// Invariant 4. Returns what goes back to the player (0 on knockout, at most stake * (1 + cap)).
pub fn settle_payout(stake: u64, boost: u8, direction: u8, entry: i64, exit: i64, max_win_multiple: u8) -> Result<u64> {
    require!(entry > 0 && exit > 0, HmError::StalePrice);
    let sign: i128 = if direction == 0 { 1 } else { -1 };
    // result = stake * boost * (exit - entry) / entry, in token units
    let result = (stake as i128)
        .checked_mul(boost as i128)
        .and_then(|x| x.checked_mul((exit as i128 - entry as i128) * sign))
        .ok_or(HmError::MathOverflow)?
        / (entry as i128);
    if result <= -(stake as i128) {
        return Ok(0);
    }
    let cap = (stake as i128).checked_mul(max_win_multiple as i128).ok_or(HmError::MathOverflow)?;
    let payout = (stake as i128).checked_add(result.min(cap)).ok_or(HmError::MathOverflow)?;
    u64::try_from(payout).map_err(|_| HmError::MathOverflow.into())
}

pub struct PythPrice {
    pub price: i64,
    pub expo: i32,
}

/// Reads a Pyth `PriceUpdateV2` account (Borsh layout of pyth-solana-receiver-sdk), without the SDK.
fn read_pyth(acc: &UncheckedAccount, cfg: &Config, now: i64) -> Result<PythPrice> {
    require_keys_eq!(acc.key(), cfg.price_feed, HmError::WrongPriceFeed);
    require_keys_eq!(*acc.owner, PYTH_RECEIVER, HmError::WrongPriceFeed);
    let data = acc.try_borrow_data()?;
    parse_price_update(&data, now, cfg.max_price_age)
}

pub fn parse_price_update(data: &[u8], now: i64, max_age: i64) -> Result<PythPrice> {
    // 8 discriminator + 32 write_authority + verification_level (Partial = 2 bytes, Full = 1 byte)
    require!(data.len() >= 42, HmError::WrongPriceFeed);
    let mut o = 40;
    o += if data[o] == 1 { 1 } else { 2 };
    o += 32; // feed_id
    require!(data.len() >= o + 28, HmError::WrongPriceFeed);
    let bad = |_: std::array::TryFromSliceError| error!(HmError::WrongPriceFeed);
    let price = i64::from_le_bytes(data[o..o + 8].try_into().map_err(bad)?);
    let expo = i32::from_le_bytes(data[o + 16..o + 20].try_into().map_err(bad)?);
    let publish_time = i64::from_le_bytes(data[o + 20..o + 28].try_into().map_err(bad)?);
    require!(price > 0, HmError::StalePrice);
    require!(now - publish_time <= max_age, HmError::StalePrice);
    Ok(PythPrice { price, expo })
}

// ---------------------------------------------------------------- accounts

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ConfigArgs {
    pub apy_bps: u16,
    pub time_warp: u32,
    pub call_duration: i64,
    pub max_boost: u8,
    pub max_win_multiple: u8,
    pub max_price_age: i64,
}

impl ConfigArgs {
    fn validate(&self) -> Result<()> {
        require!(self.apy_bps <= 5_000, HmError::BadConfig);
        require!(self.time_warp >= 1 && self.time_warp <= 1_000_000, HmError::BadConfig);
        require!(self.call_duration >= 10, HmError::BadConfig);
        require!(self.max_boost >= 1 && self.max_boost <= 10, HmError::BadConfig);
        require!(self.max_win_multiple >= 1 && self.max_win_multiple <= 10, HmError::BadConfig);
        require!(self.max_price_age > 0, HmError::BadConfig);
        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub price_feed: Pubkey,
    pub apy_bps: u16,
    pub time_warp: u32,
    pub call_duration: i64,
    pub max_boost: u8,
    pub max_win_multiple: u8,
    pub max_price_age: i64,
    pub bump: u8,
    pub yield_vault_bump: u8,
    pub house_vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Crew {
    pub creator: Pubkey,
    pub crew_id: u64,
    #[max_len(32)]
    pub name: String,
    #[max_len(8)]
    pub emoji: String,
    pub total_shares: u64,
    pub total_principal: u64,
    pub yield_paid: u64,
    pub members: u32,
    pub created_at: i64,
    pub last_accrual: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Member {
    pub crew: Pubkey,
    pub owner: Pubkey,
    pub shares: u64,
    pub principal: u64,
    pub open_call: bool,
    pub calls_played: u32,
    pub calls_won: u32,
    pub joined_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Call {
    pub member: Pubkey,
    pub crew: Pubkey,
    pub owner: Pubkey,
    pub direction: u8,
    pub boost: u8,
    pub stake: u64,
    pub entry_price: i64,
    pub expo: i32,
    pub opened_at: i64,
    pub expires_at: i64,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(init, payer = admin, seeds = [b"yield_vault"], bump,
        token::mint = mint, token::authority = config, token::token_program = token_program)]
    pub yield_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(init, payer = admin, seeds = [b"house_vault"], bump,
        token::mint = mint, token::authority = config, token::token_program = token_program)]
    pub house_vault: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: Pyth PriceUpdateV2 account; owner and layout are checked when read.
    #[account(owner = PYTH_RECEIVER)]
    pub price_feed: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = admin)]
    pub config: Account<'info, Config>,
}

#[derive(Accounts)]
#[instruction(crew_id: u64)]
pub struct CreateCrew<'info> {
    /// Pays rent (the app's sponsor), so people never need SOL.
    #[account(mut)]
    pub payer: Signer<'info>,
    pub owner: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump, has_one = mint)]
    pub config: Account<'info, Config>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(init, payer = payer, space = 8 + Crew::INIT_SPACE,
        seeds = [b"crew", owner.key().as_ref(), &crew_id.to_le_bytes()], bump)]
    pub crew: Account<'info, Crew>,
    #[account(init, payer = payer, seeds = [b"crew_vault", crew.key().as_ref()], bump,
        token::mint = mint, token::authority = crew, token::token_program = token_program)]
    pub crew_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(init, payer = payer, space = 8 + Member::INIT_SPACE,
        seeds = [b"member", crew.key().as_ref(), owner.key().as_ref()], bump)]
    pub member: Account<'info, Member>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinCrew<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub owner: Signer<'info>,
    #[account(mut, seeds = [b"crew", crew.creator.as_ref(), &crew.crew_id.to_le_bytes()], bump = crew.bump)]
    pub crew: Account<'info, Crew>,
    #[account(init, payer = payer, space = 8 + Member::INIT_SPACE,
        seeds = [b"member", crew.key().as_ref(), owner.key().as_ref()], bump)]
    pub member: Account<'info, Member>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Accrue<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = mint)]
    pub config: Account<'info, Config>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [b"crew", crew.creator.as_ref(), &crew.crew_id.to_le_bytes()], bump = crew.bump)]
    pub crew: Account<'info, Crew>,
    #[account(mut, seeds = [b"crew_vault", crew.key().as_ref()], bump = crew.vault_bump)]
    pub crew_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, seeds = [b"yield_vault"], bump = config.yield_vault_bump)]
    pub yield_vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub owner: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump, has_one = mint)]
    pub config: Account<'info, Config>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [b"crew", crew.creator.as_ref(), &crew.crew_id.to_le_bytes()], bump = crew.bump)]
    pub crew: Account<'info, Crew>,
    #[account(mut, seeds = [b"crew_vault", crew.key().as_ref()], bump = crew.vault_bump)]
    pub crew_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, seeds = [b"yield_vault"], bump = config.yield_vault_bump)]
    pub yield_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, seeds = [b"member", crew.key().as_ref(), owner.key().as_ref()], bump = member.bump, has_one = owner, has_one = crew)]
    pub member: Account<'info, Member>,
    #[account(mut, token::mint = mint, token::authority = owner, token::token_program = token_program)]
    pub owner_token: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub owner: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump, has_one = mint)]
    pub config: Account<'info, Config>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [b"crew", crew.creator.as_ref(), &crew.crew_id.to_le_bytes()], bump = crew.bump)]
    pub crew: Account<'info, Crew>,
    #[account(mut, seeds = [b"crew_vault", crew.key().as_ref()], bump = crew.vault_bump)]
    pub crew_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, seeds = [b"yield_vault"], bump = config.yield_vault_bump)]
    pub yield_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, seeds = [b"member", crew.key().as_ref(), owner.key().as_ref()], bump = member.bump, has_one = owner, has_one = crew)]
    pub member: Account<'info, Member>,
    #[account(mut, token::mint = mint, token::authority = owner, token::token_program = token_program)]
    pub owner_token: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct OpenCall<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub owner: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump, has_one = mint)]
    pub config: Account<'info, Config>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [b"crew", crew.creator.as_ref(), &crew.crew_id.to_le_bytes()], bump = crew.bump)]
    pub crew: Account<'info, Crew>,
    #[account(mut, seeds = [b"crew_vault", crew.key().as_ref()], bump = crew.vault_bump)]
    pub crew_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, seeds = [b"yield_vault"], bump = config.yield_vault_bump)]
    pub yield_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, seeds = [b"house_vault"], bump = config.house_vault_bump)]
    pub house_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, seeds = [b"member", crew.key().as_ref(), owner.key().as_ref()], bump = member.bump, has_one = owner, has_one = crew)]
    pub member: Account<'info, Member>,
    #[account(init, payer = payer, space = 8 + Call::INIT_SPACE, seeds = [b"call", member.key().as_ref()], bump)]
    pub call: Account<'info, Call>,
    /// CHECK: must equal config.price_feed and be owned by the Pyth receiver (checked in read_pyth).
    pub price_feed: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleCall<'info> {
    /// Receives the call account's rent back (the sponsor that paid it).
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump, has_one = mint)]
    pub config: Account<'info, Config>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [b"crew", crew.creator.as_ref(), &crew.crew_id.to_le_bytes()], bump = crew.bump)]
    pub crew: Account<'info, Crew>,
    #[account(mut, seeds = [b"crew_vault", crew.key().as_ref()], bump = crew.vault_bump)]
    pub crew_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, seeds = [b"yield_vault"], bump = config.yield_vault_bump)]
    pub yield_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, seeds = [b"house_vault"], bump = config.house_vault_bump)]
    pub house_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, seeds = [b"member", crew.key().as_ref(), member.owner.as_ref()], bump = member.bump, has_one = crew)]
    pub member: Account<'info, Member>,
    #[account(mut, close = payer, seeds = [b"call", member.key().as_ref()], bump = call.bump, has_one = member, has_one = crew)]
    pub call: Account<'info, Call>,
    /// CHECK: must equal config.price_feed and be owned by the Pyth receiver (checked in read_pyth).
    pub price_feed: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
}

// ---------------------------------------------------------------- events & errors

#[event]
pub struct CrewCreated { pub crew: Pubkey, pub creator: Pubkey, pub name: String }
#[event]
pub struct Deposited { pub crew: Pubkey, pub owner: Pubkey, pub amount: u64, pub shares: u64 }
#[event]
pub struct Withdrew { pub crew: Pubkey, pub owner: Pubkey, pub amount: u64, pub shares: u64 }
#[event]
pub struct Accrued { pub crew: Pubkey, pub amount: u64 }
#[event]
pub struct CallOpened { pub member: Pubkey, pub direction: u8, pub boost: u8, pub stake: u64, pub entry_price: i64, pub expires_at: i64 }
#[event]
pub struct CallSettled { pub member: Pubkey, pub exit_price: i64, pub stake: u64, pub payout: u64 }

#[error_code]
pub enum HmError {
    #[msg("Only the yield can be played; your savings are protected.")]
    PrincipalIsProtected,
    #[msg("Amount must be greater than zero.")]
    ZeroAmount,
    #[msg("Not enough shares.")]
    NotEnoughShares,
    #[msg("Direction must be 0 (up) or 1 (down).")]
    BadDirection,
    #[msg("Boost out of range.")]
    BadBoost,
    #[msg("You already have an open call.")]
    CallOpen,
    #[msg("The call has not expired yet.")]
    CallNotExpired,
    #[msg("Wrong price feed.")]
    WrongPriceFeed,
    #[msg("Price is stale or invalid.")]
    StalePrice,
    #[msg("Name must be 1-32 characters.")]
    BadName,
    #[msg("Invalid config.")]
    BadConfig,
    #[msg("Math overflow.")]
    MathOverflow,
    #[msg("The deadline must be in the future.")]
    BadDeadline,
    #[msg("Betting is closed.")]
    BetClosed,
    #[msg("Voting opens when the bet closes.")]
    BetStillOpen,
    #[msg("Already decided.")]
    AlreadyDecided,
    #[msg("You can't vote on yourself.")]
    SubjectCantVote,
    #[msg("Not decided yet.")]
    NotDecided,
    #[msg("Already claimed.")]
    AlreadyClaimed,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interest_is_simple_and_warped() {
        // $100 (6 decimals) at 5% for one year = $5
        assert_eq!(interest_due(100_000_000, 500, 31_536_000, 1).unwrap(), 5_000_000);
        // one week at 10_080x warp ~= 1 minute of wall time pays ~$5 * 7/365 * 10080 / 10080
        assert_eq!(interest_due(100_000_000, 500, 60, 10_080).unwrap(), 95_890);
        assert_eq!(interest_due(0, 500, 60, 1).unwrap(), 0);
    }

    #[test]
    fn shares_round_trip_never_creates_value() {
        let s = shares_for_assets(50_000_000, 0, 0, false).unwrap();
        let back = assets_for_shares(s, s, 50_000_000).unwrap();
        assert!(back <= 50_000_000);
        // after yield, the same shares are worth more
        let after = assets_for_shares(s, s, 51_000_000).unwrap();
        assert!(after > back);
        // burning for a stake rounds up (protocol never under-burns)
        let burn = shares_for_assets(1_000_000, s, 51_000_000, true).unwrap();
        assert!(assets_for_shares(burn, s, 51_000_000).unwrap() >= 999_999);
    }

    #[test]
    fn settlement_rules() {
        let stake = 1_000_000; // $1
        // +4% with 5x up = +20%
        assert_eq!(settle_payout(stake, 5, 0, 100_00, 104_00, 2).unwrap(), 1_200_000);
        // same move, called down = -20%
        assert_eq!(settle_payout(stake, 5, 1, 100_00, 104_00, 2).unwrap(), 800_000);
        // -20% at 5x = knockout
        assert_eq!(settle_payout(stake, 5, 0, 100_00, 80_00, 2).unwrap(), 0);
        // huge win is capped at 2x stake profit
        assert_eq!(settle_payout(stake, 5, 0, 100_00, 200_00, 2).unwrap(), 3_000_000);
    }

    #[test]
    fn parses_pyth_price_update_v2() {
        let mut d = vec![0u8; 134];
        d[40] = 1; // Full
        let o = 41 + 32;
        d[o..o + 8].copy_from_slice(&7_459_971_900i64.to_le_bytes());
        d[o + 16..o + 20].copy_from_slice(&(-8i32).to_le_bytes());
        d[o + 20..o + 28].copy_from_slice(&1_000i64.to_le_bytes());
        let p = parse_price_update(&d, 1_100, 3_600).unwrap();
        assert_eq!((p.price, p.expo), (7_459_971_900, -8));
        assert!(parse_price_update(&d, 10_000, 3_600).is_err());
    }
}
