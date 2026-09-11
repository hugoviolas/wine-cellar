CREATE TABLE `wishlist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`producer` text,
	`vintage` integer,
	`region` text,
	`color` text,
	`abv` real,
	`volume_ml` integer,
	`details` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`promoted_bottle_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`promoted_bottle_id`) REFERENCES `bottles`(`id`) ON UPDATE no action ON DELETE set null
);
