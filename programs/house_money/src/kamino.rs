//! Real yield from Kamino Lend (klend) instead of the simulated yield reserve.
//!
//! A crew's idle dollars can be supplied to one Kamino reserve chosen by the admin
//! (`config.kamino_reserve`). The crew PDA owns the cTokens it gets back, so nobody else
//! can redeem them. Interest is paid by Kamino borrowers and shows up as a higher cToken
//! exchange rate; it lands in the crew vault when the cTokens are redeemed.
//!
//! Accounting: shares are only ever priced while the whole pot sits in the vault. Any instruction
//! that prices shares (deposit, withdraw, joining a goal, the fee) fails with `KaminoNotRedeemed`
//! while the crew holds cTokens, so the client wraps it: refresh + `kamino_redeem` first (principal
//! plus interest land in the vault, so the price is exact and nobody skims accrued interest), then
//! refresh + `kamino_supply(0)` to put the whole vault back to work. Kamino requires
//! `refresh_reserve` before each supply/redeem in the same transaction; the client adds it.
//!
//! `kamino_redeem` is permissionless (it only moves the crew's own cTokens back into the crew's own
//! vault), so people can always get their money out even if the operator is gone.
//! `kamino_supply` is operator-only.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{instruction::{AccountMeta, Instruction}, program::invoke_signed};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{Config, Crew, HmError};

pub const SYSVAR_INSTRUCTIONS: Pubkey = pubkey!("Sysvar1nstructions1111111111111111111111111");
pub const KLEND_PROGRAM_ID: Pubkey = pubkey!("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
const IX_DEPOSIT_RESERVE_LIQUIDITY: [u8; 8] = [169, 201, 30, 126, 6, 205, 102, 68];
const IX_REDEEM_RESERVE_COLLATERAL: [u8; 8] = [234, 117, 181, 125, 185, 142, 220, 29];

/// Value the crew prices shares against. Only valid while nothing sits in Kamino, so that the
/// value is exact (principal plus all interest) instead of an at-cost estimate.
pub fn crew_assets(crew: &Crew, vault_amount: u64) -> Result<u64> {
    require!(crew.kamino_ctokens == 0, HmError::KaminoNotRedeemed);
    vault_amount.checked_add(crew.kamino_principal).ok_or(HmError::MathOverflow.into())
}

/// Set once: changing it later would strand cTokens of the old reserve (their value would still be counted).
pub fn set_kamino_reserve_handler(ctx: Context<SetKaminoReserve>) -> Result<()> {
    require_keys_eq!(ctx.accounts.config.kamino_reserve, Pubkey::default(), HmError::KaminoReserveSet);
    ctx.accounts.config.kamino_reserve = ctx.accounts.reserve.key();
    Ok(())
}

/// Below this, "supply everything" leaves the dollars in the vault: rounding dust (a few millionths of a
/// dollar after the last person withdraws) would mint zero cTokens and Kamino rejects it.
pub const MIN_AUTO_SUPPLY: u64 = 10_000; // $0.01 with 6 decimals

/// Supplies `amount` dollars from the vault, or the whole vault when `amount` is 0 (no-op below a cent).
pub fn kamino_supply_handler(ctx: Context<KaminoMove>, amount: u64) -> Result<()> {
    require_keys_eq!(ctx.accounts.payer.key(), ctx.accounts.config.admin, HmError::NotOperator);
    let amount = if amount == 0 {
        let all = ctx.accounts.crew_vault.amount;
        if all < MIN_AUTO_SUPPLY {
            return Ok(());
        }
        all
    } else {
        amount
    };
    require!(amount <= ctx.accounts.crew_vault.amount, HmError::ZeroAmount);
    let before = ctx.accounts.crew_ctoken.amount;
    let a = &ctx.accounts;
    let ix = Instruction {
        program_id: KLEND_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new_readonly(a.crew.key(), true),
            AccountMeta::new(a.kamino_reserve.key(), false),
            AccountMeta::new_readonly(a.lending_market.key(), false),
            AccountMeta::new_readonly(a.lending_market_authority.key(), false),
            AccountMeta::new_readonly(a.mint.key(), false),
            AccountMeta::new(a.reserve_liquidity_supply.key(), false),
            AccountMeta::new(a.reserve_collateral_mint.key(), false),
            AccountMeta::new(a.crew_vault.key(), false),
            AccountMeta::new(a.crew_ctoken.key(), false),
            AccountMeta::new_readonly(a.collateral_token_program.key(), false),
            AccountMeta::new_readonly(a.token_program.key(), false),
            AccountMeta::new_readonly(SYSVAR_INSTRUCTIONS, false),
        ],
        data: [IX_DEPOSIT_RESERVE_LIQUIDITY.as_slice(), &amount.to_le_bytes()].concat(),
    };
    invoke_klend(&ctx, ix)?;
    ctx.accounts.crew_ctoken.reload()?;
    let minted = ctx.accounts.crew_ctoken.amount.checked_sub(before).ok_or(HmError::MathOverflow)?;
    require!(minted > 0, HmError::ZeroAmount);
    let crew = &mut ctx.accounts.crew;
    crew.kamino_principal = crew.kamino_principal.checked_add(amount).ok_or(HmError::MathOverflow)?;
    crew.kamino_ctokens = crew.kamino_ctokens.checked_add(minted).ok_or(HmError::MathOverflow)?;
    emit!(KaminoSupplied { crew: crew.key(), amount, ctokens: minted });
    Ok(())
}

/// Permissionless. Redeems every cToken the crew holds. Principal plus Kamino interest return to the vault.
pub fn kamino_redeem_handler(ctx: Context<KaminoMove>) -> Result<()> {
    let ctokens = ctx.accounts.crew_ctoken.amount;
    if ctokens == 0 {
        return Ok(()); // nothing in Kamino: lets the client always prepend a redeem
    }
    let before = ctx.accounts.crew_vault.amount;
    let a = &ctx.accounts;
    let ix = Instruction {
        program_id: KLEND_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new_readonly(a.crew.key(), true),
            AccountMeta::new_readonly(a.lending_market.key(), false),
            AccountMeta::new(a.kamino_reserve.key(), false),
            AccountMeta::new_readonly(a.lending_market_authority.key(), false),
            AccountMeta::new_readonly(a.mint.key(), false),
            AccountMeta::new(a.reserve_collateral_mint.key(), false),
            AccountMeta::new(a.reserve_liquidity_supply.key(), false),
            AccountMeta::new(a.crew_ctoken.key(), false),
            AccountMeta::new(a.crew_vault.key(), false),
            AccountMeta::new_readonly(a.collateral_token_program.key(), false),
            AccountMeta::new_readonly(a.token_program.key(), false),
            AccountMeta::new_readonly(SYSVAR_INSTRUCTIONS, false),
        ],
        data: [IX_REDEEM_RESERVE_COLLATERAL.as_slice(), &ctokens.to_le_bytes()].concat(),
    };
    invoke_klend(&ctx, ix)?;
    ctx.accounts.crew_vault.reload()?;
    let received = ctx.accounts.crew_vault.amount.checked_sub(before).ok_or(HmError::MathOverflow)?;
    let crew = &mut ctx.accounts.crew;
    let principal = crew.kamino_principal;
    let earned = received.saturating_sub(principal);
    crew.kamino_principal = 0;
    crew.kamino_ctokens = 0;
    crew.yield_paid = crew.yield_paid.saturating_add(earned);
    emit!(KaminoRedeemed { crew: crew.key(), ctokens, received, earned });
    Ok(())
}

fn invoke_klend(ctx: &Context<KaminoMove>, ix: Instruction) -> Result<()> {
    let a = &ctx.accounts;
    let creator = a.crew.creator;
    let id = a.crew.crew_id.to_le_bytes();
    let bump = [a.crew.bump];
    let seeds: &[&[u8]] = &[b"crew", creator.as_ref(), &id, &bump];
    invoke_signed(
        &ix,
        &[
            a.crew.to_account_info(),
            a.kamino_reserve.to_account_info(),
            a.lending_market.to_account_info(),
            a.lending_market_authority.to_account_info(),
            a.mint.to_account_info(),
            a.reserve_liquidity_supply.to_account_info(),
            a.reserve_collateral_mint.to_account_info(),
            a.crew_vault.to_account_info(),
            a.crew_ctoken.to_account_info(),
            a.collateral_token_program.to_account_info(),
            a.token_program.to_account_info(),
            a.instructions.to_account_info(),
            a.klend_program.to_account_info(),
        ],
        &[seeds],
    )?;
    Ok(())
}

#[derive(Accounts)]
pub struct SetKaminoReserve<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = admin)]
    pub config: Account<'info, Config>,
    /// CHECK: a klend reserve; ownership is checked so only a Kamino reserve can be chosen.
    #[account(owner = KLEND_PROGRAM_ID)]
    pub reserve: UncheckedAccount<'info>,
}

/// Supply is an operator crank (the fee sponsor, which is the config admin and co-signs every app
/// transaction); redeem is open to anyone. Either way funds only travel between the crew vault and
/// cTokens owned by the crew PDA, never elsewhere.
#[derive(Accounts)]
pub struct KaminoMove<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump, has_one = mint, has_one = kamino_reserve @ HmError::BadConfig)]
    pub config: Account<'info, Config>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [b"crew", crew.creator.as_ref(), &crew.crew_id.to_le_bytes()], bump = crew.bump)]
    pub crew: Account<'info, Crew>,
    #[account(mut, seeds = [b"crew_vault", crew.key().as_ref()], bump = crew.vault_bump)]
    pub crew_vault: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: must equal config.kamino_reserve; klend validates the rest of the reserve accounts.
    #[account(mut, owner = KLEND_PROGRAM_ID)]
    pub kamino_reserve: UncheckedAccount<'info>,
    /// CHECK: validated by klend against the reserve.
    pub lending_market: UncheckedAccount<'info>,
    /// CHECK: klend PDA ["lma", market]; validated by klend.
    pub lending_market_authority: UncheckedAccount<'info>,
    /// CHECK: validated by klend against the reserve.
    #[account(mut)]
    pub reserve_liquidity_supply: UncheckedAccount<'info>,
    #[account(mut)]
    pub reserve_collateral_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init_if_needed, payer = payer,
        associated_token::mint = reserve_collateral_mint,
        associated_token::authority = crew,
        associated_token::token_program = collateral_token_program,
    )]
    pub crew_ctoken: InterfaceAccount<'info, TokenAccount>,
    pub collateral_token_program: Interface<'info, TokenInterface>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    /// CHECK: the instructions sysvar, required by klend.
    #[account(address = SYSVAR_INSTRUCTIONS)]
    pub instructions: UncheckedAccount<'info>,
    /// CHECK: the Kamino Lend program.
    #[account(address = KLEND_PROGRAM_ID)]
    pub klend_program: UncheckedAccount<'info>,
}

#[event]
pub struct KaminoSupplied { pub crew: Pubkey, pub amount: u64, pub ctokens: u64 }
#[event]
pub struct KaminoRedeemed { pub crew: Pubkey, pub ctokens: u64, pub received: u64, pub earned: u64 }
