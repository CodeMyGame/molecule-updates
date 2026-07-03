export type LicenseState =
  | 'unlicensed'      // No key stored
  | 'invalid'         // Key present but fails HMAC / bad format
  | 'expired_hard'    // More than 7 days past expiry → hard lockout
  | 'expired_grace'   // 0–7 days past expiry → works with warning
  | 'expiring_soon'   // ≤30 days until expiry → works with banner
  | 'active';         // All good

export interface LicenseStatus {
  state: LicenseState;
  tier?: number;          // 3, 6, or 12 (months)
  expiryDate?: string;    // ISO date YYYY-MM-DD
  daysRemaining?: number; // positive = days left, negative = days past expiry
  reason?: string;        // human-readable error for invalid/expired states
}
