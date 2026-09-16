ALTER TABLE `invitations` ADD `token_hash` text;--> statement-breakpoint
ALTER TABLE `password_reset_tokens` ADD `token_hash` text;--> statement-breakpoint
--> Les jetons déjà émis ne peuvent pas être convertis en leur empreinte :
--> SQLite ne sait pas calculer de SHA-256, et les recalculer côté
--> application supposerait de relire les jetons en clair, ce que cette
--> migration existe justement pour faire disparaître. Chaque ligne reçoit
--> donc une empreinte aléatoire, qu'aucun jeton ne peut produire : les
--> liens déjà envoyés cessent de fonctionner (une invitation se renvoie,
--> un lien de réinitialisation se regénère depuis l'admin), tandis que les
--> lignes elles-mêmes sont conservées — y compris les invitations déjà
--> acceptées, qui gardent leur valeur d'historique.
UPDATE `invitations` SET `token_hash` = lower(hex(randomblob(32)));--> statement-breakpoint
UPDATE `password_reset_tokens` SET `token_hash` = lower(hex(randomblob(32)));
