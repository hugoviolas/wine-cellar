export interface CheckAiQuotaArgs {
  readonly userId: string;
  /** Un super-admin n'est pas compté : voir `checkAiQuota`. */
  readonly isSuperAdmin: boolean;
  /** Instant de référence — injecté par les tests, sinon maintenant. */
  readonly now?: number;
}
