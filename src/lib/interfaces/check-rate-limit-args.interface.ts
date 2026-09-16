import type { RateLimitRule } from './rate-limit-rule.interface';

export interface CheckRateLimitArgs {
  readonly key: string;
  readonly rule: RateLimitRule;
  /** Instant de référence — injecté par les tests, sinon maintenant. */
  readonly now?: number;
}
