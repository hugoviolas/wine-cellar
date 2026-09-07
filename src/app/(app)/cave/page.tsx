import Link from 'next/link';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { cellarMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { listCrates } from '@/domain/crates';
import { listActiveBottlesByCellar } from '@/domain/bottles';
import { CrateCard } from '@/components/CrateCard';

export default async function CavePage() {
  const user = await requireUser();
  const [membership] = await db
    .select()
    .from(cellarMemberships)
    .where(eq(cellarMemberships.userId, user.id))
    .limit(1);

  if (!membership) {
    return <p className="text-sm">Aucune cave associée à ce compte.</p>;
  }

  const crates = await listCrates(db, membership.cellarId);
  const bottleRows = await listActiveBottlesByCellar(db, membership.cellarId);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg">Ma Cave</h2>
        <div className="flex gap-3 text-sm">
          <Link href="/cave/clayettes" className="text-forest underline">Gérer les clayettes</Link>
          <Link href="/cave/ajouter" className="bg-forest text-cream rounded px-3 py-1.5">+ Ajouter</Link>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-6">
        {crates.map((crate) => (
          <CrateCard
            key={crate.id}
            number={crate.number}
            name={crate.name}
            capacity={crate.capacity}
            bottles={bottleRows
              .filter((row) => row.crate.id === crate.id)
              .map((row) => ({
                id: row.bottle.id,
                name: row.bottle.name,
                vintage: row.bottle.vintage,
                quantity: row.bottle.quantity,
                color: row.bottle.color,
              }))}
          />
        ))}
      </div>
    </div>
  );
}
