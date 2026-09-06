import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isSuperAdmin: integer('is_super_admin', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

export const cellars = sqliteTable('cellars', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  aiEnabled: integer('ai_enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

export const cellarMemberships = sqliteTable('cellar_memberships', {
  id: text('id').primaryKey(),
  cellarId: text('cellar_id').notNull().references(() => cellars.id),
  userId: text('user_id').notNull().references(() => users.id),
  role: text('role', { enum: ['owner', 'editor', 'reader'] }).notNull(),
  createdAt: text('created_at').notNull(),
});

export const crates = sqliteTable('crates', {
  id: text('id').primaryKey(),
  cellarId: text('cellar_id').notNull().references(() => cellars.id),
  name: text('name').notNull(),
  capacity: integer('capacity').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const bottles = sqliteTable('bottles', {
  id: text('id').primaryKey(),
  crateId: text('crate_id').notNull().references(() => crates.id),
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
  createdAt: text('created_at').notNull(),
});

export const consumptionHistory = sqliteTable('consumption_history', {
  id: text('id').primaryKey(),
  bottleId: text('bottle_id').notNull().references(() => bottles.id),
  cellarId: text('cellar_id').notNull().references(() => cellars.id),
  consumedByUserId: text('consumed_by_user_id').notNull().references(() => users.id),
  consumedAt: text('consumed_at').notNull(),
  rating: integer('rating'),
  comment: text('comment'),
  occasion: text('occasion'),
  bottleNameSnapshot: text('bottle_name_snapshot').notNull(),
  bottleProducerSnapshot: text('bottle_producer_snapshot'),
  bottleVintageSnapshot: integer('bottle_vintage_snapshot'),
  bottleCategorySnapshot: text('bottle_category_snapshot').notNull(),
});
