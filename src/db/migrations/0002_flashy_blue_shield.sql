PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_consumption_history` (
	`id` text PRIMARY KEY NOT NULL,
	`bottle_id` text,
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
	FOREIGN KEY (`bottle_id`) REFERENCES `bottles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`cellar_id`) REFERENCES `cellars`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`consumed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_consumption_history`("id", "bottle_id", "cellar_id", "consumed_by_user_id", "consumed_at", "rating", "comment", "occasion", "bottle_name_snapshot", "bottle_producer_snapshot", "bottle_vintage_snapshot", "bottle_category_snapshot") SELECT "id", "bottle_id", "cellar_id", "consumed_by_user_id", "consumed_at", "rating", "comment", "occasion", "bottle_name_snapshot", "bottle_producer_snapshot", "bottle_vintage_snapshot", "bottle_category_snapshot" FROM `consumption_history`;--> statement-breakpoint
DROP TABLE `consumption_history`;--> statement-breakpoint
ALTER TABLE `__new_consumption_history` RENAME TO `consumption_history`;--> statement-breakpoint
PRAGMA foreign_keys=ON;