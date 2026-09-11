import Link from 'next/link';
import { db } from '@/db/client';
import { listAllUsers } from '@/domain/admin';

export default async function AdminUsersPage() {
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
