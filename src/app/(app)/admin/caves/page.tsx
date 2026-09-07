import Link from 'next/link';
import { db } from '@/db/client';
import { listAllCellarsWithOwner, countMembersByCellarId, listAllUsers } from '@/domain/admin';
import { getDbFileSizeBytes, hasApiKeyConfigured } from '@/domain/supervision';
import { CreateCellarForm } from '@/components/CreateCellarForm';

function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'fichier introuvable';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default async function AdminCellarsPage() {
  const [cellarsList, memberCounts, usersList] = await Promise.all([
    listAllCellarsWithOwner(db),
    countMembersByCellarId(db),
    listAllUsers(db),
  ]);

  return (
    <div>
      <h2 className="text-lg mb-4">Caves</h2>

      <div className="bg-white rounded p-4 mb-6 text-xs text-gray-600 space-y-1">
        <p>Base SQLite : {formatBytes(getDbFileSizeBytes())}</p>
        <p>Clé API Anthropic : {hasApiKeyConfigured() ? 'configurée' : 'non configurée'}</p>
      </div>

      <CreateCellarForm users={usersList.map((u) => ({ id: u.id, email: u.email }))} />

      <ul className="bg-white rounded divide-y divide-gray-100">
        {cellarsList.map((cellar) => (
          <li key={cellar.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>{cellar.name} — propriétaire {cellar.ownerEmail}</span>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{memberCounts[cellar.id] ?? 0} membre(s)</span>
              <Link href={`/cave?cellarId=${cellar.id}`} className="text-forest underline">
                Ouvrir
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
