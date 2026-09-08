import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { resolveBottleAccess } from '@/domain/bottleAccess';
import { ConsumeForm } from '@/components/ConsumeForm';

export default async function ConsumeBottlePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const access = await resolveBottleAccess(db, user.id, id);
  if (access.status !== 'ok') notFound();
  const bottle = access.bottle;

  if (bottle.quantity < 1) {
    return (
      <div>
        <Link href="/cave" className="text-xs text-forest mb-2 inline-block">← Retour à la cave</Link>
        <h2 className="text-lg mb-4">Consommer « {bottle.name} »</h2>
        <p className="text-sm text-gray-500">Plus aucune bouteille disponible pour cette référence.</p>
      </div>
    );
  }

  return (
    <div>
      <Link href="/cave" className="text-xs text-forest mb-2 inline-block">← Retour à la cave</Link>
      <h2 className="text-lg mb-4">Consommer « {bottle.name} »</h2>
      <ConsumeForm bottleId={bottle.id} maxQuantity={bottle.quantity} />
    </div>
  );
}
