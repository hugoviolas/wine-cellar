import Link from 'next/link';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { isAiAvailableForUser } from '@/domain/ai/available';
import { WishlistAddForm } from '@/components/WishlistAddForm';

export default async function WishlistAddPage() {
  const user = await requireUser();
  const aiAvailable = await isAiAvailableForUser(db, user.id);

  return (
    <div>
      <Link href="/wishlist" className="text-xs text-forest mb-2 inline-block">← Retour à la wishlist</Link>
      <h2 className="text-lg mb-4">Ajouter à la wishlist</h2>
      <WishlistAddForm aiAvailable={aiAvailable} />
    </div>
  );
}
