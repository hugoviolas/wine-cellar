import Link from 'next/link';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { checkCellarAccess } from '@/domain/access';
import { canManageCellar, canEditCellarContent } from '@/domain/permissions';
import { cellarMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { listCrates } from '@/domain/crates';
import { listActiveBottlesByCellar } from '@/domain/bottles';
import { CaveBoard } from '@/components/CaveBoard';
import type { BottleRow } from '@/components/CrateCard';

export default async function CavePage() {
  const user = await requireUser();
  const [membership] = await db
    .select()
    .from(cellarMemberships)
    .where(eq(cellarMemberships.userId, user.id))
    .orderBy(cellarMemberships.createdAt)
    .limit(1);

  if (!membership) {
    return <p className="text-sm">Aucune cave associée à ce compte.</p>;
  }

  const access = await checkCellarAccess(db, user.id, membership.cellarId);
  const canManage = access.allowed && canManageCellar(access.role);
  const canEdit = access.allowed && canEditCellarContent(access.role);

  const crates = await listCrates(db, membership.cellarId);
  const bottleRows = await listActiveBottlesByCellar(db, membership.cellarId);

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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg">Ma Cave</h2>
        <div className="flex gap-3 text-sm">
          <Link href="/cave/vins" className="text-forest underline">Liste des vins</Link>
          <Link href="/cave/clayettes" className="text-forest underline">Gérer les clayettes</Link>
          {canManage && <Link href="/cave/parametres" className="text-forest underline">Réglages</Link>}
          <Link href="/cave/ajouter" className="bg-forest text-cream rounded px-3 py-1.5">+ Ajouter</Link>
        </div>
      </div>
      <CaveBoard crates={crates} initialBottlesByCrate={bottlesByCrate} canEdit={canEdit} />
    </div>
  );
}
