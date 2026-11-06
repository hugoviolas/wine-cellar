import { getMemberRole, type CellarRole, type MemberRole } from '@/domain/access';
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
import type { MembershipArgs } from './interfaces/membership-args.interface';

/**
 * Contrôles d'accès des tools. Mêmes fonctions du domaine que les routes de
 * l'API, à une différence près : seules comptent les caves dont le compte
 * est **membre**. L'accès transverse du super-admin (`checkCellarAccess`)
 * reste réservé à l'app — un jeton remis à une application tierce ne doit
 * pas ouvrir les caves de toutes les inscriptions, son vol exposerait sinon
 * tout le monde.
 *
 * Ce qui est introuvable et ce qui est interdit reçoivent le même message,
 * pour ne rien révéler de l'existence d'une ressource d'une autre cave.
 */

/** Rôle du compte dans la cave, ou `null` s'il n'en est pas membre. */
const memberRole = ({ context, cellarId }: MembershipArgs): Promise<MemberRole | null> => {
  return getMemberRole({ db: context.db, userId: context.user.id, cellarId });
};

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
  const role = await memberRole({ context, cellarId: id });
  const cellar = role === null ? null : await getCellarById({ db, cellarId: id });
  if (role === null || !cellar) {
    throw new ToolError('Cave introuvable ou inaccessible : list_cellars donne les caves de ce compte.');
  }
  return { cellar, role };
};

export const resolveBottle = async ({ context, id }: ResolveByIdArgs): Promise<ResolvedBottle> => {
  const result = await resolveBottleAccess({ db: context.db, userId: context.user.id, bottleId: id });
  const crate =
    result.status === 'ok' ? await getCrateById({ db: context.db, crateId: result.bottle.crateId }) : null;
  const role = crate ? await memberRole({ context, cellarId: crate.cellarId }) : null;
  if (result.status !== 'ok' || !crate || role === null) {
    throw new ToolError('Bouteille introuvable ou inaccessible.');
  }
  return { bottle: result.bottle, crate, role };
};

export const resolveCrate = async ({ context, id }: ResolveByIdArgs): Promise<ResolvedCrate> => {
  const crate = await getCrateById({ db: context.db, crateId: id });
  const role = crate ? await memberRole({ context, cellarId: crate.cellarId }) : null;
  if (!crate || role === null) {
    throw new ToolError('Clayette introuvable ou inaccessible : get_cellar_overview liste les clayettes.');
  }
  return { crate, role };
};

export const resolveHistoryEntry = async ({
  context,
  id,
}: ResolveByIdArgs): Promise<ResolvedHistoryEntry> => {
  const result = await resolveHistoryEntryAccess({ db: context.db, userId: context.user.id, entryId: id });
  const role = result.status === 'ok' ? await memberRole({ context, cellarId: result.entry.cellarId }) : null;
  if (result.status !== 'ok' || role === null) {
    throw new ToolError('Consommation introuvable ou inaccessible.');
  }
  return { entry: result.entry, role };
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
