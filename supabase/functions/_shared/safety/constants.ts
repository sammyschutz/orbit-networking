// Tunable safety constants (spec §6, §7). Changing these is a one-line edit
// with no migration. Sliding-window rate limits are enforced server-side only.

export const MAX_MESSAGE_LENGTH = 2000;

// Truncated, redacted excerpt stored in the audit log for review (§4.5/§9).
export const AUDIT_EXCERPT_MAX = 280;

export const RATE_LIMITS = {
  // Global anti-flood per sender.
  globalMax: 30,
  globalWindowSec: 60,
  // Per-conversation throttle.
  perConversationMax: 15,
  perConversationWindowSec: 60,
  // Duplicate-body spam.
  duplicateMax: 3,
  duplicateWindowSec: 300,
  // New-connection cooldown (§12-F): at most N messages in the first window
  // after connecting, until the other party replies once.
  newConnectionMax: 5,
  newConnectionWindowSec: 600, // 10 minutes
} as const;

// Abuse heuristic score at/above which a send is hard-blocked (§6.2).
export const ABUSE_BLOCK_THRESHOLD = 3;
