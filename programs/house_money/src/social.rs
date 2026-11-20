//! Social layer: profiles, bets on real-life moments and challenges where whoever fails pays the rest.
//!
//! Everything is staked in crew *shares*, so stakes keep earning the crew's yield while they are locked
//! (a bet or a challenge "rinde" until it settles). No tokens move: shares go from a member to the
//! bet/challenge account and back to the winners, inside the same crew vault.
//!
//! Invariants:
//! S1. Shares are conserved: sum(member shares) + sum(locked in bets/challenges) never changes on
//!     stake, vote or claim (claims pay out exactly what was locked, rounding dust stays locked).
//! S2. One vote per member per bet/entry (a Vote PDA is created per voter; a second init fails).
//! S3. The subject of a bet can't vote on it; a challenge participant can't vote on their own entry.
//! S4. Outcomes are final once a strict majority of eligible members agrees.
//! S5. If nobody is on the winning side (or nobody completes a challenge), everyone gets their stake back.
//!
//! Burn the Boats (commitments): each participant states their own goal and stake; only people who
//! staked in the same commitment can verify others; forfeits go 95% to those who did it and 5% to the
//! platform (taken once, by `take_fee`, into the config-owned treasury vault).
//! S6. The platform cut is exactly PLATFORM_FEE_BPS of the forfeits, only when someone completed, and only once.
//! S7. Only participants of a commitment vote on it.
//!
//! Disputes (QuickNode Streams / Grok Bot appeals): `open_dispute` lets a participant flag one entry of a
//! commitment as contested. It writes a separate `Dispute` PDA (so no existing account changes size) and logs
//! `KEPT:DisputeOpened ...` plus a `DisputeOpened` event, which an off-chain Stream picks up.
//! S9. Only participants can open a dispute, only once per entry, only after the commitment ends and before
//!     the entry is collected. Opening a dispute moves no money and does not block settlement (advisory flag).
//! S8. No commitment can lock money forever: after `ends_at + VOTE_WINDOW_SECS` anyone can finalize an
//!     undecided entry (plurality of cast votes; a tie or no votes refunds it).

use anchor_lang::prelude::*;

use crate::{Crew, HmError, Member};

pub const MAX_QUESTION_LEN: usize = 80;
pub const MAX_PROFILE_NAME_LEN: usize = 24;

pub const OPEN: u8 = 0;
pub const YES: u8 = 1;
pub const NO: u8 = 2;

/// Platform share of forfeited stakes (5%). The other 95% goes to those who did it.
pub const PLATFORM_FEE_BPS: u64 = 500;
pub const MAX_GOAL_LEN: usize = 80;

/// Dispute reason codes (opaque to the program, shown by the app).
pub const DISPUTE_OTHER: u8 = 0;
/// "The proof does not show what it claims."
pub const DISPUTE_PROOF: u8 = 1;
/// "I did it and the group marked me as missed" (an appeal by the entry's own owner).
pub const DISPUTE_APPEAL: u8 = 2;
/// "The group marked this as done and it was not."
pub const DISPUTE_FALSE_PASS: u8 = 3;
pub const MAX_DISPUTE_REASON: u8 = DISPUTE_FALSE_PASS;

pub const PENDING: u8 = 0;
pub const PASSED: u8 = 1;
pub const FAILED: u8 = 2;
/// Not enough votes by the end of the voting window: the stake goes back to its owner, untouched.
pub const REFUNDED: u8 = 3;
/// Voting window after the deadline. Short for the demo; a production value would be ~48h.
pub const VOTE_WINDOW_SECS: i64 = 120;

/// Outcome of an entry nobody could settle by strict majority before the window closed:
/// a plurality of cast votes decides; a tie or no votes refunds the stake (S8).
/// After the window, an entry nobody decided by strict majority. Nobody loses money without a strict majority
/// of the other participants (which `vote_entry` already applies), so a lone "no" can never take a stake:
/// more "yes" than "no" keeps it (PASSED), anything else refunds it.
pub fn finalize_outcome(pass_votes: u16, fail_votes: u16) -> u8 {
    if pass_votes > fail_votes {
        PASSED
    } else {
        REFUNDED
    }
}

// ---------------------------------------------------------------- pure math (unit tested)

/// Strict majority of `eligible` voters (at least 1).
pub fn majority(eligible: u32) -> u32 {
    eligible / 2 + 1
}

/// What a winner takes home: their stake plus a pro-rata cut of the losers' stakes.
/// If nobody won, everyone gets their own stake back (S5).
pub fn winner_payout(own: u64, winners_total: u64, losers_total: u64) -> Result<u64> {
    if winners_total == 0 {
        return Ok(own);
    }
    let bonus = (losers_total as u128)
        .checked_mul(own as u128)
        .ok_or(HmError::MathOverflow)?
        / winners_total as u128;
    u64::try_from(own as u128 + bonus).map_err(|_| HmError::MathOverflow.into())
}

/// Platform cut of the forfeits: 0 if nobody completed (everyone is refunded).
pub fn platform_fee(passed_total: u64, failed_total: u64) -> u64 {
    if passed_total == 0 {
        return 0;
    }
    // u64 * 500 / 10_000 always fits back in u64; saturating keeps the linter and future edits honest.
    let fee = (failed_total as u128).saturating_mul(PLATFORM_FEE_BPS as u128) / 10_000;
    u64::try_from(fee).unwrap_or(u64::MAX).min(failed_total)
}

/// What someone who did it takes home: their stake plus a pro-rata share of 95% of the forfeits.
pub fn commitment_payout(own: u64, passed_total: u64, failed_total: u64) -> Result<u64> {
    let to_winners = failed_total
        .checked_sub(platform_fee(passed_total, failed_total))
        .ok_or(HmError::MathOverflow)?;
    winner_payout(own, passed_total, to_winners)
}

// ---------------------------------------------------------------- accounts

/// One person's goal inside a commitment ("Run 21 km by Sunday").
#[account]
#[derive(InitSpace)]
pub struct GoalNote {
    pub entry: Pubkey,
    #[max_len(80)]
    pub goal: String,
    pub bump: u8,
}

/// Marker so the platform cut is taken only once per commitment (S6).
#[account]
#[derive(InitSpace)]
pub struct FeeTaken {
    pub challenge: Pubkey,
    pub shares: u64,
    pub amount: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Profile {
    pub owner: Pubkey,
    #[max_len(24)]
    pub name: String,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Bet {
    pub crew: Pubkey,
    pub creator: Pubkey,
    pub bet_id: u64,
    #[max_len(80)]
    pub question: String,
    /// The person the bet is about (can't vote). Pubkey::default() when it's about nobody in the crew.
    pub subject: Pubkey,
    pub closes_at: i64,
    pub yes_shares: u64,
    pub no_shares: u64,
    pub bettors: u16,
    pub yes_votes: u16,
    pub no_votes: u16,
    pub outcome: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub bet: Pubkey,
    pub owner: Pubkey,
    pub side: u8,
    pub shares: u64,
    pub claimed: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Challenge {
    pub crew: Pubkey,
    pub creator: Pubkey,
    pub challenge_id: u64,
    #[max_len(80)]
    pub title: String,
    /// Stake per participant, in dollar units (6 decimals); converted to shares when joining.
    pub stake: u64,
    pub ends_at: i64,
    pub participants: u16,
    pub decided: u16,
    pub passed_shares: u64,
    pub failed_shares: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Entry {
    pub challenge: Pubkey,
    pub owner: Pubkey,
    pub shares: u64,
    pub pass_votes: u16,
    pub fail_votes: u16,
    pub status: u8,
    pub claimed: bool,
    pub bump: u8,
}

/// A contested entry. One per entry (PDA seeded by the entry), created by `open_dispute`.
/// Kept apart from `Entry` on purpose: adding a field to `Entry` would break every existing account.
#[account]
#[derive(InitSpace)]
pub struct Dispute {
    pub challenge: Pubkey,
    pub entry: Pubkey,
    /// The entry's owner (the person whose result is contested).
    pub member: Pubkey,
    pub opener: Pubkey,
    pub reason: u8,
    pub opened_at: i64,
    pub bump: u8,
}

/// Marker so a member can vote only once on a bet or an entry (S2).
#[account]
#[derive(InitSpace)]
pub struct Vote {
    pub voter: Pubkey,
    pub choice: u8,
    pub bump: u8,
}

// ---------------------------------------------------------------- handlers

pub fn set_profile_handler(ctx: Context<SetProfile>, name: String) -> Result<()> {
    require!(!name.trim().is_empty() && name.len() <= MAX_PROFILE_NAME_LEN, HmError::BadName);
    let p = &mut ctx.accounts.profile;
    p.owner = ctx.accounts.owner.key();
    p.name = name;
    p.bump = ctx.bumps.profile;
    Ok(())
}

pub fn create_bet_handler(ctx: Context<CreateBet>, bet_id: u64, question: String, subject: Pubkey, closes_at: i64) -> Result<()> {
    // Bets are off: they had no way to settle without a majority of every member, so stakes could stay
    // locked forever (audit H2). The app never used them; existing bets can still be voted and claimed.
    require!(false, HmError::Disabled);
    require!(!question.trim().is_empty() && question.len() <= MAX_QUESTION_LEN, HmError::BadName);
    let now = Clock::get()?.unix_timestamp;
    require!(closes_at > now, HmError::BadDeadline);
    let b = &mut ctx.accounts.bet;
    b.crew = ctx.accounts.crew.key();
    b.creator = ctx.accounts.owner.key();
    b.bet_id = bet_id;
    b.question = question;
    b.subject = subject;
    b.closes_at = closes_at;
    b.yes_shares = 0;
    b.no_shares = 0;
    b.bettors = 0;
    b.yes_votes = 0;
    b.no_votes = 0;
    b.outcome = OPEN;
    b.bump = ctx.bumps.bet;
    emit!(BetCreated { bet: b.key(), crew: b.crew, question: b.question.clone(), closes_at });
    Ok(())
}

pub fn place_bet_handler(ctx: Context<PlaceBet>, side: u8, shares: u64) -> Result<()> {
    require!(side == YES || side == NO, HmError::BadDirection);
    require!(shares > 0, HmError::ZeroAmount);
    require!(!ctx.accounts.member.open_call, HmError::CallOpen);
    let now = Clock::get()?.unix_timestamp;
    let b = &mut ctx.accounts.bet;
    require!(b.outcome == OPEN && now < b.closes_at, HmError::BetClosed);
    let m = &mut ctx.accounts.member;
    require!(shares <= m.shares, HmError::NotEnoughShares);
    m.shares -= shares;
    if side == YES {
        b.yes_shares = b.yes_shares.checked_add(shares).ok_or(HmError::MathOverflow)?;
    } else {
        b.no_shares = b.no_shares.checked_add(shares).ok_or(HmError::MathOverflow)?;
    }
    b.bettors = b.bettors.saturating_add(1);
    let p = &mut ctx.accounts.position;
    p.bet = b.key();
    p.owner = m.owner;
    p.side = side;
    p.shares = shares;
    p.claimed = false;
    p.bump = ctx.bumps.position;
    emit!(BetPlaced { bet: b.key(), owner: m.owner, side, shares });
    Ok(())
}

pub fn vote_bet_handler(ctx: Context<VoteBet>, choice: u8) -> Result<()> {
    require!(choice == YES || choice == NO, HmError::BadDirection);
    let now = Clock::get()?.unix_timestamp;
    let crew_members = ctx.accounts.crew.members;
    let b = &mut ctx.accounts.bet;
    require!(now >= b.closes_at, HmError::BetStillOpen);
    require!(b.outcome == OPEN, HmError::AlreadyDecided);
    let voter = ctx.accounts.owner.key();
    require_keys_neq!(voter, b.subject, HmError::SubjectCantVote); // S3
    let v = &mut ctx.accounts.vote;
    v.voter = voter;
    v.choice = choice;
    v.bump = ctx.bumps.vote;
    if choice == YES {
        b.yes_votes += 1;
    } else {
        b.no_votes += 1;
    }
    let subject_in_crew = b.subject != Pubkey::default();
    let eligible = (crew_members as u32).saturating_sub(subject_in_crew as u32).max(1);
    let need = majority(eligible) as u16;
    if b.yes_votes >= need {
        b.outcome = YES;
    } else if b.no_votes >= need {
        b.outcome = NO;
    }
    if b.outcome != OPEN {
        emit!(BetResolved { bet: b.key(), outcome: b.outcome });
    }
    Ok(())
}

pub fn claim_bet_handler(ctx: Context<ClaimBet>) -> Result<()> {
    let b = &ctx.accounts.bet;
    require!(b.outcome != OPEN, HmError::NotDecided);
    let p = &mut ctx.accounts.position;
    require!(!p.claimed, HmError::AlreadyClaimed);
    let (winners, losers) = if b.outcome == YES { (b.yes_shares, b.no_shares) } else { (b.no_shares, b.yes_shares) };
    let payout = if winners == 0 {
        p.shares // S5: nobody won, refund
    } else if p.side == b.outcome {
        winner_payout(p.shares, winners, losers)?
    } else {
        0
    };
    p.claimed = true;
    let m = &mut ctx.accounts.member;
    m.shares = m.shares.checked_add(payout).ok_or(HmError::MathOverflow)?;
    emit!(BetClaimed { bet: b.key(), owner: m.owner, shares: payout });
    Ok(())
}

pub fn create_challenge_handler(ctx: Context<CreateChallenge>, challenge_id: u64, title: String, stake: u64, ends_at: i64) -> Result<()> {
    require!(!title.trim().is_empty() && title.len() <= MAX_QUESTION_LEN, HmError::BadName);
    require!(stake > 0, HmError::ZeroAmount);
    let now = Clock::get()?.unix_timestamp;
    require!(ends_at > now, HmError::BadDeadline);
    let c = &mut ctx.accounts.challenge;
    c.crew = ctx.accounts.crew.key();
    c.creator = ctx.accounts.owner.key();
    c.challenge_id = challenge_id;
    c.title = title;
    c.stake = stake;
    c.ends_at = ends_at;
    c.participants = 0;
    c.decided = 0;
    c.passed_shares = 0;
    c.failed_shares = 0;
    c.bump = ctx.bumps.challenge;
    emit!(ChallengeCreated { challenge: c.key(), crew: c.crew, title: c.title.clone(), stake, ends_at });
    Ok(())
}

pub fn join_challenge_handler(ctx: Context<JoinChallenge>) -> Result<()> {
    require!(!ctx.accounts.member.open_call, HmError::CallOpen);
    let now = Clock::get()?.unix_timestamp;
    let c = &mut ctx.accounts.challenge;
    require!(now < c.ends_at, HmError::BetClosed);
    let vault = crate::crew_assets(&ctx.accounts.crew, ctx.accounts.crew_vault.amount)?;
    let total = ctx.accounts.crew.total_shares;
    // The stake is a dollar amount; lock the shares worth that much right now (rounded up).
    let shares = crate::shares_for_assets(c.stake, total, vault, true)?;
    let m = &mut ctx.accounts.member;
    require!(shares > 0 && shares <= m.shares, HmError::NotEnoughShares);
    m.shares -= shares;
    c.participants = c.participants.checked_add(1).ok_or(HmError::MathOverflow)?;
    let e = &mut ctx.accounts.entry;
    e.challenge = c.key();
    e.owner = m.owner;
    e.shares = shares;
    e.pass_votes = 0;
    e.fail_votes = 0;
    e.status = PENDING;
    e.claimed = false;
    e.bump = ctx.bumps.entry;
    emit!(ChallengeJoined { challenge: c.key(), owner: m.owner, shares });
    Ok(())
}

pub fn vote_entry_handler(ctx: Context<VoteEntry>, passed: bool) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let c = &mut ctx.accounts.challenge;
    require!(now >= c.ends_at, HmError::BetStillOpen);
    require!(now < c.ends_at.saturating_add(VOTE_WINDOW_SECS), HmError::VotingClosed);
    // S7: the voter must have staked in this same commitment (voter_entry is seeded by challenge + voter).
    require_keys_eq!(ctx.accounts.voter_entry.challenge, c.key(), HmError::NotAParticipant);
    let e = &mut ctx.accounts.entry;
    require!(e.status == PENDING, HmError::AlreadyDecided);
    let voter = ctx.accounts.owner.key();
    require_keys_neq!(voter, e.owner, HmError::SubjectCantVote); // S3
    let v = &mut ctx.accounts.vote;
    v.voter = voter;
    v.choice = if passed { PASSED } else { FAILED };
    v.bump = ctx.bumps.vote;
    if passed {
        e.pass_votes += 1;
    } else {
        e.fail_votes += 1;
    }
    let need = majority((c.participants as u32).saturating_sub(1).max(1)) as u16;
    if e.pass_votes >= need {
        e.status = PASSED;
        c.passed_shares = c.passed_shares.checked_add(e.shares).ok_or(HmError::MathOverflow)?;
    } else if e.fail_votes >= need {
        e.status = FAILED;
        c.failed_shares = c.failed_shares.checked_add(e.shares).ok_or(HmError::MathOverflow)?;
    }
    if e.status != PENDING {
        c.decided += 1;
        emit!(EntryDecided { challenge: c.key(), owner: e.owner, status: e.status });
    }
    Ok(())
}

/// Flags one entry as contested and announces it in the logs for off-chain listeners (QuickNode Streams).
pub fn open_dispute_handler(ctx: Context<OpenDispute>, reason: u8) -> Result<()> {
    require!(reason <= MAX_DISPUTE_REASON, HmError::BadReason);
    let now = Clock::get()?.unix_timestamp;
    let c = &ctx.accounts.challenge;
    // Same window as voting: the commitment is over, so there is a result to contest...
    require!(now >= c.ends_at, HmError::BetStillOpen);
    // ...and the entry has not been collected yet.
    let e = &ctx.accounts.entry;
    require!(!e.claimed, HmError::AlreadyClaimed);
    // S9: the opener must have staked in this same commitment (opener_entry is seeded by challenge + opener).
    require_keys_eq!(ctx.accounts.opener_entry.challenge, c.key(), HmError::NotAParticipant);

    let d = &mut ctx.accounts.dispute;
    d.challenge = c.key();
    d.entry = e.key();
    d.member = e.owner;
    d.opener = ctx.accounts.opener.key();
    d.reason = reason;
    d.opened_at = now;
    d.bump = ctx.bumps.dispute;

    // One plain-text line with a fixed prefix: easy to filter in a Stream and to parse without an IDL.
    msg!(
        "KEPT:DisputeOpened challenge={} member={} disputer={} reason={} dispute={}",
        d.challenge, d.member, d.opener, reason, d.key()
    );
    emit!(DisputeOpened { challenge: d.challenge, member: d.member, disputer: d.opener, reason, dispute: d.key() });
    Ok(())
}

pub fn claim_challenge_handler(ctx: Context<ClaimChallenge>) -> Result<()> {
    let c = &ctx.accounts.challenge;
    require!(c.participants > 0 && c.decided == c.participants, HmError::NotDecided);
    let e = &mut ctx.accounts.entry;
    require!(!e.claimed, HmError::AlreadyClaimed);
    let payout = if c.passed_shares == 0 || e.status == REFUNDED {
        e.shares // S5/S8: nobody completed, or the entry was never decided: refund
    } else if e.status == PASSED {
        commitment_payout(e.shares, c.passed_shares, c.failed_shares)?
    } else {
        0
    };
    e.claimed = true;
    let m = &mut ctx.accounts.member;
    m.shares = m.shares.checked_add(payout).ok_or(HmError::MathOverflow)?;
    emit!(ChallengeClaimed { challenge: c.key(), owner: m.owner, shares: payout });
    Ok(())
}

/// S8: after the voting window, settles an entry the group never decided. Permissionless.
pub fn finalize_entry_handler(ctx: Context<FinalizeEntry>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let c = &mut ctx.accounts.challenge;
    require!(now >= c.ends_at.saturating_add(VOTE_WINDOW_SECS), HmError::BetStillOpen);
    let e = &mut ctx.accounts.entry;
    require!(e.status == PENDING, HmError::AlreadyDecided);
    e.status = finalize_outcome(e.pass_votes, e.fail_votes);
    match e.status {
        PASSED => c.passed_shares = c.passed_shares.checked_add(e.shares).ok_or(HmError::MathOverflow)?,
        FAILED => c.failed_shares = c.failed_shares.checked_add(e.shares).ok_or(HmError::MathOverflow)?,
        _ => {}
    }
    c.decided = c.decided.checked_add(1).ok_or(HmError::MathOverflow)?;
    emit!(EntryDecided { challenge: c.key(), owner: e.owner, status: e.status });
    Ok(())
}

/// Join a commitment with your own goal and your own stake (in dollars, at least the commitment's minimum).
pub fn join_with_goal_handler(ctx: Context<JoinWithGoal>, goal: String, stake: u64) -> Result<()> {
    require!(!goal.trim().is_empty() && goal.len() <= MAX_GOAL_LEN, HmError::BadName);
    require!(!ctx.accounts.member.open_call, HmError::CallOpen);
    let now = Clock::get()?.unix_timestamp;
    let c = &mut ctx.accounts.challenge;
    require!(now < c.ends_at, HmError::BetClosed);
    require!(stake >= c.stake, HmError::StakeTooLow);
    let vault = crate::crew_assets(&ctx.accounts.crew, ctx.accounts.crew_vault.amount)?;
    let total = ctx.accounts.crew.total_shares;
    let shares = crate::shares_for_assets(stake, total, vault, true)?;
    let m = &mut ctx.accounts.member;
    require!(shares > 0 && shares <= m.shares, HmError::NotEnoughShares);
    m.shares -= shares;
    c.participants = c.participants.checked_add(1).ok_or(HmError::MathOverflow)?;
    let e = &mut ctx.accounts.entry;
    e.challenge = c.key();
    e.owner = m.owner;
    e.shares = shares;
    e.pass_votes = 0;
    e.fail_votes = 0;
    e.status = PENDING;
    e.claimed = false;
    e.bump = ctx.bumps.entry;
    let g = &mut ctx.accounts.goal;
    g.entry = e.key();
    g.goal = goal;
    g.bump = ctx.bumps.goal;
    emit!(ChallengeJoined { challenge: c.key(), owner: m.owner, shares });
    Ok(())
}

/// Moves the platform's 5% of the forfeits out of the group pot into the treasury, once (S6). Permissionless.
pub fn take_fee_handler(ctx: Context<TakeFee>) -> Result<()> {
    let c = &ctx.accounts.challenge;
    require!(c.participants > 0 && c.decided == c.participants, HmError::NotDecided);
    let fee_shares = platform_fee(c.passed_shares, c.failed_shares);
    let vault = crate::crew_assets(&ctx.accounts.crew, ctx.accounts.crew_vault.amount)?;
    let total = ctx.accounts.crew.total_shares;
    let amount = crate::assets_for_shares(fee_shares, total, vault)?;
    if amount > 0 {
        let creator = ctx.accounts.crew.creator;
        let id = ctx.accounts.crew.crew_id.to_le_bytes();
        let bump = [ctx.accounts.crew.bump];
        let seeds: &[&[u8]] = &[b"crew", creator.as_ref(), &id, &bump];
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                anchor_spl::token_interface::TransferChecked {
                    from: ctx.accounts.crew_vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                    authority: ctx.accounts.crew.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;
    }
    // The fee shares leave the pot together with their dollars, so everyone else's share price is unchanged.
    let crew = &mut ctx.accounts.crew;
    crew.total_shares = crew.total_shares.checked_sub(fee_shares).ok_or(HmError::MathOverflow)?;
    let f = &mut ctx.accounts.fee;
    f.challenge = c.key();
    f.shares = fee_shares;
    f.amount = amount;
    f.bump = ctx.bumps.fee;
    emit!(FeeCollected { challenge: c.key(), shares: fee_shares, amount });
    Ok(())
}

// ---------------------------------------------------------------- contexts

#[derive(Accounts)]
pub struct SetProfile<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub owner: Signer<'info>,
    #[account(init_if_needed, payer = payer, space = 8 + Profile::INIT_SPACE, seeds = [b"profile", owner.key().as_ref()], bump)]
    pub profile: Account<'info, Profile>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(bet_id: u64)]
pub struct CreateBet<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub owner: Signer<'info>,
    #[account(seeds = [b"crew", crew.creator.as_ref(), &crew.crew_id.to_le_bytes()], bump = crew.bump)]
    pub crew: Account<'info, Crew>,
    #[account(seeds = [b"member", crew.key().as_ref(), owner.key().as_ref()], bump = member.bump, has_one = owner, has_one = crew)]
    pub member: Account<'info, Member>,
    #[account(init, payer = payer, space = 8 + Bet::INIT_SPACE,
        seeds = [b"bet", crew.key().as_ref(), &bet_id.to_le_bytes()], bump)]
    pub bet: Account<'info, Bet>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub owner: Signer<'info>,
    pub crew: Account<'info, Crew>,
    #[account(mut, seeds = [b"member", crew.key().as_ref(), owner.key().as_ref()], bump = member.bump, has_one = owner, has_one = crew)]
    pub member: Account<'info, Member>,
    #[account(mut, seeds = [b"bet", crew.key().as_ref(), &bet.bet_id.to_le_bytes()], bump = bet.bump, has_one = crew)]
    pub bet: Account<'info, Bet>,
    #[account(init, payer = payer, space = 8 + Position::INIT_SPACE,
        seeds = [b"position", bet.key().as_ref(), owner.key().as_ref()], bump)]
    pub position: Account<'info, Position>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VoteBet<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub owner: Signer<'info>,
    pub crew: Account<'info, Crew>,
    #[account(seeds = [b"member", crew.key().as_ref(), owner.key().as_ref()], bump = member.bump, has_one = owner, has_one = crew)]
    pub member: Account<'info, Member>,
    #[account(mut, seeds = [b"bet", crew.key().as_ref(), &bet.bet_id.to_le_bytes()], bump = bet.bump, has_one = crew)]
    pub bet: Account<'info, Bet>,
    #[account(init, payer = payer, space = 8 + Vote::INIT_SPACE,
        seeds = [b"vote", bet.key().as_ref(), owner.key().as_ref()], bump)]
    pub vote: Account<'info, Vote>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimBet<'info> {
    pub owner: Signer<'info>,
    pub crew: Account<'info, Crew>,
    #[account(mut, seeds = [b"member", crew.key().as_ref(), owner.key().as_ref()], bump = member.bump, has_one = owner, has_one = crew)]
    pub member: Account<'info, Member>,
    #[account(seeds = [b"bet", crew.key().as_ref(), &bet.bet_id.to_le_bytes()], bump = bet.bump, has_one = crew)]
    pub bet: Account<'info, Bet>,
    #[account(mut, seeds = [b"position", bet.key().as_ref(), owner.key().as_ref()], bump = position.bump, has_one = owner, has_one = bet)]
    pub position: Account<'info, Position>,
}

#[derive(Accounts)]
#[instruction(challenge_id: u64)]
pub struct CreateChallenge<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub owner: Signer<'info>,
    #[account(seeds = [b"crew", crew.creator.as_ref(), &crew.crew_id.to_le_bytes()], bump = crew.bump)]
    pub crew: Account<'info, Crew>,
    #[account(seeds = [b"member", crew.key().as_ref(), owner.key().as_ref()], bump = member.bump, has_one = owner, has_one = crew)]
    pub member: Account<'info, Member>,
    #[account(init, payer = payer, space = 8 + Challenge::INIT_SPACE,
        seeds = [b"challenge", crew.key().as_ref(), &challenge_id.to_le_bytes()], bump)]
    pub challenge: Account<'info, Challenge>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinChallenge<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub owner: Signer<'info>,
    #[account(seeds = [b"crew", crew.creator.as_ref(), &crew.crew_id.to_le_bytes()], bump = crew.bump)]
    pub crew: Account<'info, Crew>,
    #[account(seeds = [b"crew_vault", crew.key().as_ref()], bump = crew.vault_bump)]
    pub crew_vault: InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>,
    #[account(mut, seeds = [b"member", crew.key().as_ref(), owner.key().as_ref()], bump = member.bump, has_one = owner, has_one = crew)]
    pub member: Account<'info, Member>,
    #[account(mut, seeds = [b"challenge", crew.key().as_ref(), &challenge.challenge_id.to_le_bytes()], bump = challenge.bump, has_one = crew)]
    pub challenge: Account<'info, Challenge>,
    #[account(init, payer = payer, space = 8 + Entry::INIT_SPACE,
        seeds = [b"entry", challenge.key().as_ref(), owner.key().as_ref()], bump)]
    pub entry: Account<'info, Entry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VoteEntry<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub owner: Signer<'info>,
    pub crew: Account<'info, Crew>,
    #[account(seeds = [b"member", crew.key().as_ref(), owner.key().as_ref()], bump = member.bump, has_one = owner, has_one = crew)]
    pub member: Account<'info, Member>,
    #[account(mut, seeds = [b"challenge", crew.key().as_ref(), &challenge.challenge_id.to_le_bytes()], bump = challenge.bump, has_one = crew)]
    pub challenge: Account<'info, Challenge>,
    #[account(mut, seeds = [b"entry", challenge.key().as_ref(), entry.owner.as_ref()], bump = entry.bump, has_one = challenge)]
    pub entry: Account<'info, Entry>,
    /// The voter's own stake in this commitment (S7: only participants vote).
    #[account(seeds = [b"entry", challenge.key().as_ref(), owner.key().as_ref()], bump = voter_entry.bump)]
    pub voter_entry: Account<'info, Entry>,
    #[account(init, payer = payer, space = 8 + Vote::INIT_SPACE,
        seeds = [b"vote", entry.key().as_ref(), owner.key().as_ref()], bump)]
    pub vote: Account<'info, Vote>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OpenDispute<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub opener: Signer<'info>,
    #[account(seeds = [b"challenge", challenge.crew.as_ref(), &challenge.challenge_id.to_le_bytes()], bump = challenge.bump)]
    pub challenge: Account<'info, Challenge>,
    /// The contested entry.
    #[account(seeds = [b"entry", challenge.key().as_ref(), entry.owner.as_ref()], bump = entry.bump, has_one = challenge)]
    pub entry: Account<'info, Entry>,
    /// The opener's own stake in this commitment (S9: only participants open disputes).
    #[account(seeds = [b"entry", challenge.key().as_ref(), opener.key().as_ref()], bump = opener_entry.bump)]
    pub opener_entry: Account<'info, Entry>,
    /// `init` makes a second dispute on the same entry fail.
    #[account(init, payer = payer, space = 8 + Dispute::INIT_SPACE,
        seeds = [b"dispute", entry.key().as_ref()], bump)]
    pub dispute: Account<'info, Dispute>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeEntry<'info> {
    pub crew: Account<'info, Crew>,
    #[account(mut, seeds = [b"challenge", crew.key().as_ref(), &challenge.challenge_id.to_le_bytes()], bump = challenge.bump, has_one = crew)]
    pub challenge: Account<'info, Challenge>,
    #[account(mut, seeds = [b"entry", challenge.key().as_ref(), entry.owner.as_ref()], bump = entry.bump, has_one = challenge)]
    pub entry: Account<'info, Entry>,
}

#[derive(Accounts)]
pub struct ClaimChallenge<'info> {
    pub owner: Signer<'info>,
    pub crew: Account<'info, Crew>,
    #[account(mut, seeds = [b"member", crew.key().as_ref(), owner.key().as_ref()], bump = member.bump, has_one = owner, has_one = crew)]
    pub member: Account<'info, Member>,
    #[account(seeds = [b"challenge", crew.key().as_ref(), &challenge.challenge_id.to_le_bytes()], bump = challenge.bump, has_one = crew)]
    pub challenge: Account<'info, Challenge>,
    #[account(mut, seeds = [b"entry", challenge.key().as_ref(), owner.key().as_ref()], bump = entry.bump, has_one = owner, has_one = challenge)]
    pub entry: Account<'info, Entry>,
}

#[derive(Accounts)]
pub struct JoinWithGoal<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub owner: Signer<'info>,
    #[account(seeds = [b"crew", crew.creator.as_ref(), &crew.crew_id.to_le_bytes()], bump = crew.bump)]
    pub crew: Account<'info, Crew>,
    #[account(seeds = [b"crew_vault", crew.key().as_ref()], bump = crew.vault_bump)]
    pub crew_vault: InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>,
    #[account(mut, seeds = [b"member", crew.key().as_ref(), owner.key().as_ref()], bump = member.bump, has_one = owner, has_one = crew)]
    pub member: Account<'info, Member>,
    #[account(mut, seeds = [b"challenge", crew.key().as_ref(), &challenge.challenge_id.to_le_bytes()], bump = challenge.bump, has_one = crew)]
    pub challenge: Account<'info, Challenge>,
    #[account(init, payer = payer, space = 8 + Entry::INIT_SPACE,
        seeds = [b"entry", challenge.key().as_ref(), owner.key().as_ref()], bump)]
    pub entry: Account<'info, Entry>,
    #[account(init, payer = payer, space = 8 + GoalNote::INIT_SPACE,
        seeds = [b"goal", entry.key().as_ref()], bump)]
    pub goal: Account<'info, GoalNote>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TakeFee<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump, has_one = mint)]
    pub config: Account<'info, crate::Config>,
    pub mint: InterfaceAccount<'info, anchor_spl::token_interface::Mint>,
    #[account(mut, seeds = [b"crew", crew.creator.as_ref(), &crew.crew_id.to_le_bytes()], bump = crew.bump)]
    pub crew: Account<'info, Crew>,
    #[account(mut, seeds = [b"crew_vault", crew.key().as_ref()], bump = crew.vault_bump)]
    pub crew_vault: InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>,
    /// The platform treasury: the config-owned "house" vault.
    #[account(mut, seeds = [b"house_vault"], bump = config.house_vault_bump)]
    pub treasury: InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>,
    #[account(seeds = [b"challenge", crew.key().as_ref(), &challenge.challenge_id.to_le_bytes()], bump = challenge.bump, has_one = crew)]
    pub challenge: Account<'info, Challenge>,
    #[account(init, payer = payer, space = 8 + FeeTaken::INIT_SPACE,
        seeds = [b"fee", challenge.key().as_ref()], bump)]
    pub fee: Account<'info, FeeTaken>,
    pub token_program: anchor_lang::prelude::Interface<'info, anchor_spl::token_interface::TokenInterface>,
    pub system_program: Program<'info, System>,
}

// ---------------------------------------------------------------- events

#[event]
pub struct FeeCollected { pub challenge: Pubkey, pub shares: u64, pub amount: u64 }

#[event]
pub struct BetCreated { pub bet: Pubkey, pub crew: Pubkey, pub question: String, pub closes_at: i64 }
#[event]
pub struct BetPlaced { pub bet: Pubkey, pub owner: Pubkey, pub side: u8, pub shares: u64 }
#[event]
pub struct BetResolved { pub bet: Pubkey, pub outcome: u8 }
#[event]
pub struct BetClaimed { pub bet: Pubkey, pub owner: Pubkey, pub shares: u64 }
#[event]
pub struct ChallengeCreated { pub challenge: Pubkey, pub crew: Pubkey, pub title: String, pub stake: u64, pub ends_at: i64 }
#[event]
pub struct ChallengeJoined { pub challenge: Pubkey, pub owner: Pubkey, pub shares: u64 }
#[event]
pub struct EntryDecided { pub challenge: Pubkey, pub owner: Pubkey, pub status: u8 }
#[event]
pub struct DisputeOpened { pub challenge: Pubkey, pub member: Pubkey, pub disputer: Pubkey, pub reason: u8, pub dispute: Pubkey }
#[event]
pub struct ChallengeClaimed { pub challenge: Pubkey, pub owner: Pubkey, pub shares: u64 }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn majority_is_strict() {
        assert_eq!(majority(1), 1);
        assert_eq!(majority(2), 2);
        assert_eq!(majority(3), 2);
        assert_eq!(majority(4), 3);
        assert_eq!(majority(5), 3);
    }

    #[test]
    fn winners_split_losers_pro_rata_and_shares_are_conserved() {
        // Yes: 30 + 10, No: 60. Yes wins.
        let (w, l) = (40u64, 60u64);
        let a = winner_payout(30, w, l).unwrap();
        let b = winner_payout(10, w, l).unwrap();
        assert_eq!(a, 30 + 45);
        assert_eq!(b, 10 + 15);
        assert!(a + b <= w + l); // S1: never pays out more than was locked
    }

    #[test]
    fn rounding_never_creates_shares() {
        let (w, l) = (3u64, 10u64);
        let total: u64 = [1u64, 1, 1].iter().map(|s| winner_payout(*s, w, l).unwrap()).sum();
        assert!(total <= w + l);
    }

    #[test]
    fn platform_takes_five_percent_and_winners_the_rest() {
        // Two did it with 100 each; one failed with 100. Fee 5, winners split 95.
        assert_eq!(platform_fee(200, 100), 5);
        let a = commitment_payout(100, 200, 100).unwrap();
        assert_eq!(a, 100 + 47); // 95 * 100 / 200 = 47.5 -> 47
        assert!(2 * a + platform_fee(200, 100) <= 300); // S1 + S6: never more than was locked
        assert_eq!(platform_fee(0, 100), 0); // nobody did it: no fee, everyone refunded
    }

    #[test]
    fn nobody_won_means_refund() {
        assert_eq!(winner_payout(25, 0, 100).unwrap(), 25);
    }

    #[test]
    fn finalize_never_fails_anyone_without_a_majority() {
        // S8: one participant (nobody can vote on them) -> refund, never locked.
        assert_eq!(finalize_outcome(0, 0), REFUNDED);
        // Two participants, the other never voted -> refund.
        assert_eq!(finalize_outcome(0, 0), REFUNDED);
        // Three participants, split 1-1 -> refund.
        assert_eq!(finalize_outcome(1, 1), REFUNDED);
        // More "yes" than "no" keeps the stake.
        assert_eq!(finalize_outcome(1, 0), PASSED);
        assert_eq!(finalize_outcome(2, 1), PASSED);
        // A minority of "no" votes never takes a stake: refund.
        assert_eq!(finalize_outcome(0, 1), REFUNDED);
        assert_eq!(finalize_outcome(1, 2), REFUNDED);
    }

    #[test]
    fn matches_the_app_settlement_rule() {
        // Same case as scripts/check-settlement.mts: five people, $50 each, two keep their word.
        // Program works in units of 1e-6 dollars; the app shows cents.
        let (stake, kept, missed) = (50_000_000u64, 100_000_000u64, 150_000_000u64);
        assert_eq!(platform_fee(kept, missed), 7_500_000); // $7.50
        assert_eq!(commitment_payout(stake, kept, missed).unwrap(), 121_250_000); // $121.25
        let paid = 2 * commitment_payout(stake, kept, missed).unwrap() + platform_fee(kept, missed);
        assert_eq!(paid, kept + missed); // every dollar accounted for
    }

    #[test]
    fn fee_never_exceeds_forfeits() {
        for f in [0u64, 1, 19, 20, 21, 1_000_000, u64::MAX / 10_000] {
            assert!(platform_fee(1, f) <= f);
        }
    }
}
