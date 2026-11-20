// Single source for the product name and the split shown to people. Change them here only.
// Name: Kept (team decision, relayed by Martin on 20 Nov 2026; earlier working name "Burn the Boats").
export const PROJECT_NAME = "Kept";
export const TAGLINE = "Promises that keep themselves.";

// What the program does with forfeits: the platform takes FEE_PERCENT once, the rest is shared
// pro rata among the friends who kept their word. Keep this equal to the program's fee_bps / 100.
export const FEE_PERCENT = 5;
export const KEEPERS_PERCENT = 100 - FEE_PERCENT;

// Stake chips offered when locking money on a goal.
export const STAKE_CHIPS = [10, 20, 50] as const;
