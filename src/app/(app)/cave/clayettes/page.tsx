import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { listCrates } from '@/domain/crates';
import { cellarMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { CrateManager } from '@/components/CrateManager';

export default async function ClayettesPage() {
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
      <h2 className="text-lg mb-4">Gérer les clayettes</h2>
      {membership ? (
        <CrateManager cellarId={membership.cellarId} initialCrates={crates} />
      ) : (
        <p className="text-sm">Aucune cave associée à ce compte.</p>
      )}
    </div>
  );
}
