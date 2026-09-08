import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { resolveViewedCellarId } from '@/domain/viewedCellar';
import { listCrates } from '@/domain/crates';
import { CrateManager } from '@/components/CrateManager';

export default async function ClayettesPage({
  searchParams,
}: {
  searchParams: Promise<{ cellarId?: string }>;
}) {
  const user = await requireUser();
  const { cellarId: requestedCellarId } = await searchParams;
  const cellarId = await resolveViewedCellarId(db, user.id, requestedCellarId);

  const crates = cellarId ? await listCrates(db, cellarId) : [];

  return (
    <div>
      <h2 className="text-lg mb-4">Gérer les clayettes</h2>
      {cellarId ? (
        <CrateManager cellarId={cellarId} initialCrates={crates} />
      ) : (
        <p className="text-sm">Aucune cave associée à ce compte.</p>
      )}
    </div>
  );
}
