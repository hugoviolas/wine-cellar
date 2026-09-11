import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isSuperAdmin: integer('is_super_admin', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  // Horodatage ISO du dernier geste qui doit invalider les sessions déjà
  // ouvertes de ce compte (aujourd'hui : une réinitialisation de mot de
  // passe). Une session émise avant cette date est refusée — voir
  // domain/sessionValidity.ts. `null` = aucun geste de ce type depuis la
  // création du compte, donc toutes ses sessions restent valides.
  sessionsValidFrom: text('sessions_valid_from'),
  createdAt: text('created_at').notNull(),
});

export const cellars = sqliteTable('cellars', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  // Nullable + set null (pas notNull) : `deleteUser` ne supprime jamais les
  // caves qu'un compte possède, mais efface la ligne `users` elle-même — la
  // cave doit donc pouvoir survivre avec un propriétaire nul plutôt que de
  // bloquer la suppression du compte (voir domain/admin.ts).
  ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
  brand: text('brand'),
  model: text('model'),
  notes: text('notes'),
  aiEnabled: integer('ai_enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

export const cellarMemberships = sqliteTable('cellar_memberships', {
  id: text('id').primaryKey(),
  cellarId: text('cellar_id').notNull().references(() => cellars.id),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  role: text('role', { enum: ['owner', 'editor', 'reader'] }).notNull(),
  createdAt: text('created_at').notNull(),
});

export const crates = sqliteTable('crates', {
  id: text('id').primaryKey(),
  cellarId: text('cellar_id').notNull().references(() => cellars.id),
  number: integer('number').notNull().default(1),
  name: text('name'),
  capacity: integer('capacity').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const bottles = sqliteTable('bottles', {
  id: text('id').primaryKey(),
  crateId: text('crate_id').references(() => crates.id, { onDelete: 'set null' }),
  sortOrder: integer('sort_order').notNull().default(0),
  category: text('category', {
    enum: ['wine', 'sparkling', 'cider', 'beer', 'spirit'],
  }).notNull(),
  name: text('name').notNull(),
  producer: text('producer'),
  vintage: integer('vintage'),
  region: text('region'),
  color: text('color'),
  abv: real('abv'),
  volumeMl: integer('volume_ml'),
  quantity: integer('quantity').notNull().default(1),
  drinkFrom: integer('drink_from'),
  drinkUntil: integer('drink_until'),
  details: text('details', { mode: 'json' }).notNull(),
  aiAnalysis: text('ai_analysis'),
  aiPairings: text('ai_pairings', { mode: 'json' }),
  aiTastingAdvice: text('ai_tasting_advice'),
  aiGeneratedAt: text('ai_generated_at'),
  userNote: text('user_note'),
  rating: integer('rating'),
  createdAt: text('created_at').notNull(),
});

export const consumptionHistory = sqliteTable('consumption_history', {
  id: text('id').primaryKey(),
  bottleId: text('bottle_id').references(() => bottles.id, { onDelete: 'set null' }),
  cellarId: text('cellar_id').notNull().references(() => cellars.id),
  consumedByUserId: text('consumed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  consumedAt: text('consumed_at').notNull(),
  quantity: integer('quantity').notNull().default(1),
  rating: integer('rating'),
  comment: text('comment'),
  occasion: text('occasion'),
  bottleNameSnapshot: text('bottle_name_snapshot').notNull(),
  bottleProducerSnapshot: text('bottle_producer_snapshot'),
  bottleVintageSnapshot: integer('bottle_vintage_snapshot'),
  bottleCategorySnapshot: text('bottle_category_snapshot').notNull(),
});

export const invitations = sqliteTable('invitations', {
  id: text('id').primaryKey(),
  cellarId: text('cellar_id').notNull().references(() => cellars.id),
  email: text('email').notNull(),
  role: text('role', { enum: ['editor', 'reader'] }).notNull(),
  token: text('token').notNull().unique(),
  status: text('status', { enum: ['pending', 'accepted', 'expired'] }).notNull().default('pending'),
  invitedByUserId: text('invited_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
});

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
  createdAt: text('created_at').notNull(),
});

export const appSettings = sqliteTable('app_settings', {
  id: text('id').primaryKey(),
  registrationEnabled: integer('registration_enabled', { mode: 'boolean' }).notNull().default(true),
});

export const wishlistItems = sqliteTable('wishlist_items', {
  id: text('id').primaryKey(),
  // Nullable + set null, même raison que cellars.ownerId : deleteUser ne
  // supprime jamais ce qu'un compte possède, seulement la ligne users.
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  category: text('category', {
    enum: ['wine', 'sparkling', 'cider', 'beer', 'spirit'],
  }).notNull(),
  name: text('name').notNull(),
  producer: text('producer'),
  vintage: integer('vintage'),
  region: text('region'),
  color: text('color'),
  abv: real('abv'),
  volumeMl: integer('volume_ml'),
  details: text('details', { mode: 'json' }).notNull(),
  status: text('status', { enum: ['pending', 'promoted'] }).notNull().default('pending'),
  promotedBottleId: text('promoted_bottle_id').references(() => bottles.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
});
