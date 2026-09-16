import type {
  appSettings,
  bottles,
  cellarMemberships,
  cellars,
  consumptionHistory,
  crates,
  invitations,
  passwordResetTokens,
  users,
  wishlistItems,
} from './schema';

/**
 * Types de ligne dérivés du schéma, un par table. Ils existent pour que les
 * fonctions du domaine puissent annoncer leur type de retour sans le
 * réécrire à la main : la source de vérité reste `schema.ts`, une colonne
 * ajoutée se propage ici toute seule.
 */
export type UserRow = typeof users.$inferSelect;
export type CellarRow = typeof cellars.$inferSelect;
export type CellarMembershipRow = typeof cellarMemberships.$inferSelect;
export type CrateRow = typeof crates.$inferSelect;
export type BottleRow = typeof bottles.$inferSelect;
export type ConsumptionHistoryRow = typeof consumptionHistory.$inferSelect;
export type InvitationRow = typeof invitations.$inferSelect;
export type PasswordResetTokenRow = typeof passwordResetTokens.$inferSelect;
export type WishlistItemRow = typeof wishlistItems.$inferSelect;
export type AppSettingsRow = typeof appSettings.$inferSelect;
