CREATE TABLE `bottles` (
	`id` text PRIMARY KEY NOT NULL,
	`crate_id` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`producer` text,
	`vintage` integer,
	`region` text,
	`color` text,
	`abv` real,
	`volume_ml` integer,
	`quantity` integer DEFAULT 1 NOT NULL,
	`drink_from` integer,
	`drink_until` integer,
	`details` text NOT NULL,
	`ai_analysis` text,
	`ai_pairings` text,
	`ai_tasting_advice` text,
	`ai_generated_at` text,
	`user_note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`crate_id`) REFERENCES `crates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cellar_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`cellar_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`cellar_id`) REFERENCES `cellars`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cellars` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`ai_enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `consumption_history` (
	`id` text PRIMARY KEY NOT NULL,
	`bottle_id` text NOT NULL,
	`cellar_id` text NOT NULL,
	`consumed_by_user_id` text NOT NULL,
	`consumed_at` text NOT NULL,
	`rating` integer,
	`comment` text,
	`occasion` text,
	`bottle_name_snapshot` text NOT NULL,
	`bottle_producer_snapshot` text,
	`bottle_vintage_snapshot` integer,
	`bottle_category_snapshot` text NOT NULL,
	FOREIGN KEY (`bottle_id`) REFERENCES `bottles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cellar_id`) REFERENCES `cellars`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`consumed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `crates` (
	`id` text PRIMARY KEY NOT NULL,
	`cellar_id` text NOT NULL,
	`name` text NOT NULL,
	`capacity` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`cellar_id`) REFERENCES `cellars`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`is_super_admin` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);