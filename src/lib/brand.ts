// Single source for the product name and the split shown to people. Change them here only.
// Name: Kept (team decision, relayed by Martin on 20 Nov 2026; earlier working name "Burn the Boats").
export const PROJECT_NAME = "Kept";
export const TAGLINE = "Promises that keep themselves.";

// What the program does with forfeits: the platform takes FEE_PERCENT once, the rest is shared
// pro rata among the friends who kept their word. Keep this equal to the program's fee_bps / 100.
export const FEE_PERCENT = 5;
export const KEEPERS_PERCENT = 100 - FEE_PERCENT;

// Stakes have to hurt (product decision 20 Nov, spec section 13): no fixed chips. The goal coach suggests an
// amount; below the suggested minimum we nudge, far above 3x the suggestion we ask for a second confirmation.
export const STAKE_SUGGESTED_MIN = 50;
export const STAKE_WARN_MULTIPLE = 3;

// Roadmap numbers shown as simulated in the demo (spec 13.1 and 13.3). Not final, not real money.
export const YIELD_APY_PERCENT = 4;
export const PLATFORM_YIELD_PERCENT = 35;
// Leaving early keeps this share of the stake in the pot (suggested, not closed).
export const LEAVE_EARLY_LOSS_PERCENT = 50;
