import { checkCellarAccess, type CellarRole } from '@/domain/access';
import { resolveBottleAccess } from '@/domain/bottleAccess';
import { getCellarById } from '@/domain/cellars';
import { getCrateById } from '@/domain/crates';
import { resolveHistoryEntryAccess } from '@/domain/history';
import { canEditCellarContent } from '@/domain/permissions';
import { resolveViewedCellarId } from '@/domain/viewedCellar';
import { resolveWishlistItemAccess } from '@/domain/wishlist';
import type { WishlistItemRow } from '@/db/rows';
import { ToolError } from './toolResult';
import type { ResolvedCellar } from './interfaces/resolved-cellar.interface';
import type { ResolvedBottle } from './interfaces/resolved-bottle.interface';
import type { ResolvedCrate } from './interfaces/resolved-crate.interface';
import type { ResolvedHistoryEntry } from './interfaces/resolved-history-entry.interface';
import type { ResolveCellarArgs } from './interfaces/resolve-cellar-args.interface';
import type { ResolveByIdArgs } from './interfaces/resolve-by-id-args.interface';

/**
 * Contrôles d'accès des tools, calqués sur ceux des routes de l'API : mêmes
 * fonctions du domaine, mêmes règles. Ce qui est introuvable et ce qui est
 * interdit reçoivent le même message, pour ne rien révéler de l'existence
 * d'une ressource d'une autre cave.
 */

/**
 * Cave visée par un tool : celle demandée, ou à défaut la première de
 * l'utilisateur — la même que l'app ouvre par défaut.
 */
export const resolveCellar = async ({ context, cellarId }: ResolveCellarArgs): Promise<ResolvedCellar> => {
  const { db, user } = context;
  const id = cellarId ?? (await resolveViewedCellarId({ db, userId: user.id, requestedCellarId: undefined }));
  if (id === null) {
    throw new ToolError(
      "Aucune cave pour ce compte : il faut d'abord en créer une dans l'application Ma Cave.",
    );
  }
  const access = await checkCellarAccess({ db, userId: user.id, cellarId: id });
  const cellar = access.allowed ? await getCellarById({ db, cellarId: id }) : null;
  if (!access.allowed || !cellar) {
    throw new ToolError('Cave introuvable ou inaccessible : list_cellars donne les caves de ce compte.');
  }
  return { cellar, role: access.role };
};

export const resolveBottle = async ({ context, id }: ResolveByIdArgs): Promise<ResolvedBottle> => {
  const result = await resolveBottleAccess({ db: context.db, userId: context.user.id, bottleId: id });
  if (result.status !== 'ok') {
    throw new ToolError('Bouteille introuvable ou inaccessible.');
  }
  const crate = await getCrateById({ db: context.db, crateId: result.bottle.crateId });
  if (!crate) {
    throw new ToolError('Bouteille introuvable ou inaccessible.');
  }
  return { bottle: result.bottle, crate, role: result.role };
};

export const resolveCrate = async ({ context, id }: ResolveByIdArgs): Promise<ResolvedCrate> => {
  const crate = await getCrateById({ db: context.db, crateId: id });
  const access = crate
    ? await checkCellarAccess({ db: context.db, userId: context.user.id, cellarId: crate.cellarId })
    : null;
  if (!crate || !access?.allowed) {
    throw new ToolError('Clayette introuvable ou inaccessible : get_cellar_overview liste les clayettes.');
  }
  return { crate, role: access.role };
};

export const resolveHistoryEntry = async ({
  context,
  id,
}: ResolveByIdArgs): Promise<ResolvedHistoryEntry> => {
  const result = await resolveHistoryEntryAccess({ db: context.db, userId: context.user.id, entryId: id });
  if (result.status !== 'ok') {
    throw new ToolError('Consommation introuvable ou inaccessible.');
  }
  return { entry: result.entry, role: result.role };
};

/** La wishlist est strictement personnelle : aucun accès transverse, même super-admin. */
export const resolveWishlistItem = async ({ context, id }: ResolveByIdArgs): Promise<WishlistItemRow> => {
  const result = await resolveWishlistItemAccess({ db: context.db, userId: context.user.id, itemId: id });
  if (result.status !== 'ok') {
    throw new ToolError('Item de wishlist introuvable.');
  }
  return result.item;
};

/** Modification du contenu d'une cave : propriétaire et éditeurs seulement. */
export const requireEditor = (role: CellarRole): void => {
  if (!canEditCellarContent(role)) {
    throw new ToolError(
      'Rôle insuffisant : ce compte est lecteur de cette cave. Il peut consommer une bouteille et la noter, mais pas modifier le contenu de la cave.',
    );
  }
};
