PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_cellar_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`cellar_id` text NOT NULL,
	`user_id` text,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`cellar_id`) REFERENCES `cellars`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_cellar_memberships`("id", "cellar_id", "user_id", "role", "created_at") SELECT "id", "cellar_id", "user_id", "role", "created_at" FROM `cellar_memberships`;--> statement-breakpoint
DROP TABLE `cellar_memberships`;--> statement-breakpoint
ALTER TABLE `__new_cellar_memberships` RENAME TO `cellar_memberships`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_cellars` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text,
	`brand` text,
	`model` text,
	`notes` text,
	`ai_enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_cellars`("id", "name", "owner_id", "brand", "model", "notes", "ai_enabled", "created_at") SELECT "id", "name", "owner_id", "brand", "model", "notes", "ai_enabled", "created_at" FROM `cellars`;--> statement-breakpoint
DROP TABLE `cellars`;--> statement-breakpoint
ALTER TABLE `__new_cellars` RENAME TO `cellars`;--> statement-breakpoint
CREATE TABLE `__new_consumption_history` (
	`id` text PRIMARY KEY NOT NULL,
	`bottle_id` text,
	`cellar_id` text NOT NULL,
	`consumed_by_user_id` text,
	`consumed_at` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`rating` integer,
	`comment` text,
	`occasion` text,
	`bottle_name_snapshot` text NOT NULL,
	`bottle_producer_snapshot` text,
	`bottle_vintage_snapshot` integer,
	`bottle_category_snapshot` text NOT NULL,
	FOREIGN KEY (`bottle_id`) REFERENCES `bottles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`cellar_id`) REFERENCES `cellars`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`consumed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_consumption_history`("id", "bottle_id", "cellar_id", "consumed_by_user_id", "consumed_at", "quantity", "rating", "comment", "occasion", "bottle_name_snapshot", "bottle_producer_snapshot", "bottle_vintage_snapshot", "bottle_category_snapshot") SELECT "id", "bottle_id", "cellar_id", "consumed_by_user_id", "consumed_at", "quantity", "rating", "comment", "occasion", "bottle_name_snapshot", "bottle_producer_snapshot", "bottle_vintage_snapshot", "bottle_category_snapshot" FROM `consumption_history`;--> statement-breakpoint
DROP TABLE `consumption_history`;--> statement-breakpoint
ALTER TABLE `__new_consumption_history` RENAME TO `consumption_history`;--> statement-breakpoint
CREATE TABLE `__new_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`cellar_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`token` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invited_by_user_id` text,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`cellar_id`) REFERENCES `cellars`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_invitations`("id", "cellar_id", "email", "role", "token", "status", "invited_by_user_id", "expires_at", "created_at") SELECT "id", "cellar_id", "email", "role", "token", "status", "invited_by_user_id", "expires_at", "created_at" FROM `invitations`;--> statement-breakpoint
DROP TABLE `invitations`;--> statement-breakpoint
ALTER TABLE `__new_invitations` RENAME TO `invitations`;--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_token_unique` ON `invitations` (`token`);--> statement-breakpoint
CREATE TABLE `__new_password_reset_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_password_reset_tokens`("id", "user_id", "token", "expires_at", "used_at", "created_at") SELECT "id", "user_id", "token", "expires_at", "used_at", "created_at" FROM `password_reset_tokens`;--> statement-breakpoint
DROP TABLE `password_reset_tokens`;--> statement-breakpoint
ALTER TABLE `__new_password_reset_tokens` RENAME TO `password_reset_tokens`;--> statement-breakpoint
CREATE UNIQUE INDEX `password_reset_tokens_token_unique` ON `password_reset_tokens` (`token`);