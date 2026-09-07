'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Member {
  membershipId: string;
  email: string;
  role: 'owner' | 'editor' | 'reader';
}

export function MembersList({ initialMembers }: { initialMembers: Member[] }) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [error, setError] = useState<string | null>(null);

  async function readError(response: Response, fallback: string): Promise<string> {
    const data = await response.json().catch(() => null);
    return typeof data?.error === 'string' ? data.error : fallback;
  }

  async function changeRole(membershipId: string, role: 'editor' | 'reader') {
    setError(null);
    const response = await fetch(`/api/cellar-memberships/${membershipId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!response.ok) {
      setError(await readError(response, 'Impossible de changer ce rôle.'));
      return;
    }
    setMembers(members.map((m) => (m.membershipId === membershipId ? { ...m, role } : m)));
    router.refresh();
  }

  async function removeMember(membershipId: string) {
    setError(null);
    const response = await fetch(`/api/cellar-memberships/${membershipId}`, { method: 'DELETE' });
    if (!response.ok) {
      setError(await readError(response, 'Impossible de retirer ce membre.'));
      return;
    }
    setMembers(members.filter((m) => m.membershipId !== membershipId));
    router.refresh();
  }

  return (
    <div className="bg-white rounded">
      {error && <p className="text-sm text-red-700 px-4 pt-3">{error}</p>}
      <ul className="divide-y divide-gray-100">
        {members.map((member) => (
          <li key={member.membershipId} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>{member.email}</span>
            {member.role === 'owner' ? (
              <span className="text-xs text-gray-500">Propriétaire</span>
            ) : (
              <div className="flex items-center gap-3">
                <select
                  value={member.role}
                  onChange={(e) => changeRole(member.membershipId, e.target.value as 'editor' | 'reader')}
                  className="border border-gray-300 rounded px-2 py-1 text-xs"
                >
                  <option value="editor">Éditeur</option>
                  <option value="reader">Lecteur</option>
                </select>
                <button
                  onClick={() => removeMember(member.membershipId)}
                  className="text-red-700 text-xs"
                >
                  Retirer
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
