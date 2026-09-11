import Link from 'next/link';
import { db } from '@/db/client';
import { requireSuperAdmin } from '@/lib/requireSuperAdmin';
import { listAllUsers } from '@/domain/admin';

export default async function AdminUsersPage() {
  // Garde répétée dans chaque page /admin (et pas seulement dans le layout) :
  // layout et page sont rendus en parallèle, et le `redirect()` du layout
  // n'empêche pas le rendu de la page — son payload RSC part quand même dans
  // le corps de la réponse 307, lisible par n'importe quel compte connecté.
  await requireSuperAdmin();
  const usersList = await listAllUsers(db);

  return (
    <div>
      <h2 className="text-lg mb-4">Utilisateurs</h2>
      <ul className="bg-white rounded divide-y divide-gray-100">
        {usersList.map((u) => (
          <li key={u.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <Link href={`/admin/utilisateurs/${u.id}`} className="text-forest underline">
              {u.email}
            </Link>
            <span className="text-xs text-gray-500">
              {u.isSuperAdmin ? 'Super-admin' : 'Compte standard'} ·{' '}
              {u.isActive ? 'Actif' : 'Désactivé'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
