import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { getBottle } from '@/domain/bottles';
import { ConsumeForm } from '@/components/ConsumeForm';

export default async function ConsumeBottlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bottle = await getBottle(db, id);
  if (!bottle) notFound();

  return (
    <div>
      <h2 className="text-lg mb-4">Consommer « {bottle.name} »</h2>
      <ConsumeForm bottleId={bottle.id} />
    </div>
  );
}
