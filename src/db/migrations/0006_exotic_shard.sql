PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_crates` (
	`id` text PRIMARY KEY NOT NULL,
	`cellar_id` text NOT NULL,
	`number` integer DEFAULT 1 NOT NULL,
	`name` text,
	`capacity` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`cellar_id`) REFERENCES `cellars`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_crates`("id", "cellar_id", "number", "name", "capacity", "sort_order", "created_at") SELECT "id", "cellar_id", "number", "name", "capacity", "sort_order", "created_at" FROM `crates`;--> statement-breakpoint
DROP TABLE `crates`;--> statement-breakpoint
ALTER TABLE `__new_crates` RENAME TO `crates`;--> statement-breakpoint
PRAGMA foreign_keys=ON;