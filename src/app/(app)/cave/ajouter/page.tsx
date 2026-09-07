import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { cellarMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { listCrates } from '@/domain/crates';
import { AddBottleForm } from '@/components/AddBottleForm';

export default async function AddBottlePage() {
  const user = await requireUser();
  const [membership] = await db
    .select()
    .from(cellarMemberships)
    .where(eq(cellarMemberships.userId, user.id))
    .orderBy(cellarMemberships.createdAt)
    .limit(1);

  const crates = membership ? await listCrates(db, membership.cellarId) : [];

  return (
    <div>
      <h2 className="text-lg mb-4">Ajouter une bouteille</h2>
      {crates.length === 0 ? (
        <p className="text-sm">Crée d’abord une clayette avant d’ajouter une bouteille.</p>
      ) : (
        <AddBottleForm crates={crates} />
      )}
    </div>
  );
}
