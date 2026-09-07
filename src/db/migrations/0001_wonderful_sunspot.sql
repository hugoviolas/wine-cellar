PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bottles` (
	`id` text PRIMARY KEY NOT NULL,
	`crate_id` text,
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
	FOREIGN KEY (`crate_id`) REFERENCES `crates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_bottles`("id", "crate_id", "category", "name", "producer", "vintage", "region", "color", "abv", "volume_ml", "quantity", "drink_from", "drink_until", "details", "ai_analysis", "ai_pairings", "ai_tasting_advice", "ai_generated_at", "user_note", "created_at") SELECT "id", "crate_id", "category", "name", "producer", "vintage", "region", "color", "abv", "volume_ml", "quantity", "drink_from", "drink_until", "details", "ai_analysis", "ai_pairings", "ai_tasting_advice", "ai_generated_at", "user_note", "created_at" FROM `bottles`;--> statement-breakpoint
DROP TABLE `bottles`;--> statement-breakpoint
ALTER TABLE `__new_bottles` RENAME TO `bottles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `crates` ADD `number` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
UPDATE `crates` SET `number` = (
	SELECT COUNT(*) FROM `crates` AS `c2`
	WHERE `c2`.`cellar_id` = `crates`.`cellar_id`
	AND (`c2`.`created_at` < `crates`.`created_at`
		OR (`c2`.`created_at` = `crates`.`created_at` AND `c2`.`id` <= `crates`.`id`))
);