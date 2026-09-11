import Link from 'next/link';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { checkCellarAccess } from '@/domain/access';
import { canManageCellar, canEditCellarContent } from '@/domain/permissions';
import { resolveViewedCellarId } from '@/domain/viewedCellar';
import { listCrates } from '@/domain/crates';
import { listActiveBottlesByCellar } from '@/domain/bottles';
import { getCellarById } from '@/domain/cellars';
import { CaveBoard } from '@/components/CaveBoard';
import type { BottleRow } from '@/components/CrateCard';

export default async function CavePage({
  searchParams,
}: {
  searchParams: Promise<{ cellarId?: string }>;
}) {
  const user = await requireUser();
  const { cellarId: requestedCellarId } = await searchParams;
  const cellarId = await resolveViewedCellarId(db, user.id, requestedCellarId);

  if (!cellarId) {
    return <p className="text-sm">Aucune cave associée à ce compte.</p>;
  }

  const access = await checkCellarAccess(db, user.id, cellarId);
  const canManage = access.allowed && canManageCellar(access.role);
  const canEdit = access.allowed && canEditCellarContent(access.role);

  const crates = await listCrates(db, cellarId);
  const bottleRows = await listActiveBottlesByCellar(db, cellarId);
  const cellar = await getCellarById(db, cellarId);

  const totalBottles = bottleRows.reduce((sum, row) => sum + row.bottle.quantity, 0);
  const totalCapacity = crates.reduce((sum, crate) => sum + crate.capacity, 0);
  const cellarSubtitle = [cellar?.brand, cellar?.model].filter(Boolean).join(' ');

  // Propagé aux sous-liens uniquement quand cette page a elle-même été
  // ouverte avec un cellarId explicite (ex. lien "Ouvrir" du dashboard
  // admin) — la navigation normale d'un utilisateur sur sa propre cave
  // garde des URLs sans paramètre.
  const cellarQuery = requestedCellarId ? `?cellarId=${cellarId}` : '';

  const bottlesByCrate: Record<string, BottleRow[]> = {};
  for (const crate of crates) {
    bottlesByCrate[crate.id] = bottleRows
      .filter((row) => row.crate.id === crate.id)
      .map((row) => ({
        id: row.bottle.id,
        name: row.bottle.name,
        category: row.bottle.category,
        vintage: row.bottle.vintage,
        quantity: row.bottle.quantity,
        color: row.bottle.color,
      }));
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-6 pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-2xl">{cellar?.name ?? 'Ma Cave'}</h2>
          <p className="text-xs text-sage mt-1">
            {cellarSubtitle && `${cellarSubtitle} · `}
            {totalBottles} bouteille{totalBottles > 1 ? 's' : ''} sur {totalCapacity} emplacements
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href={`/cave/vins${cellarQuery}`}
            className="border border-gray-300 text-forest rounded px-3 py-1.5 hover:bg-white whitespace-nowrap"
          >
            Liste des vins
          </Link>
          <Link
            href={`/cave/clayettes${cellarQuery}`}
            className="border border-gray-300 text-forest rounded px-3 py-1.5 hover:bg-white whitespace-nowrap"
          >
            Gérer les clayettes
          </Link>
          {canManage && (
            <Link
              href={`/cave/parametres${cellarQuery}`}
              className="border border-gray-300 text-forest rounded px-3 py-1.5 hover:bg-white whitespace-nowrap"
            >
              Gérer la cave
            </Link>
          )}
          <Link href={`/cave/ajouter${cellarQuery}`} className="bg-forest text-cream rounded px-3 py-1.5 whitespace-nowrap">+ Ajouter</Link>
        </div>
      </div>
      <CaveBoard crates={crates} initialBottlesByCrate={bottlesByCrate} canEdit={canEdit} />
    </div>
  );
}
