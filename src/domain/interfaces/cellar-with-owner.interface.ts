/**
 * Cave telle que la liste l'affiche dans l'admin. `ownerEmail` est nul
 * quand le compte propriétaire a été supprimé — la cave lui survit (voir
 * `deleteUser`), l'UI affiche alors « compte supprimé ».
 */
export interface CellarWithOwner {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string | null;
  readonly ownerEmail: string | null;
  readonly aiEnabled: boolean;
  readonly createdAt: string;
}
