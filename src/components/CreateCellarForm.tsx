'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserOption } from './interfaces/user-option.interface';
import { errorMessageFromResponse } from '@/lib/apiError';
import type { ReactElement } from 'react';

export const CreateCellarForm = ({ users }: { users: UserOption[] }): ReactElement => {
  const router = useRouter();
  const [name, setName] = useState('');
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    const response = await fetch('/api/admin/cellars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ownerId }),
    });
    if (!response.ok) {
      setError(await errorMessageFromResponse(response, 'Impossible de créer cette cave.'));
      return;
    }
    setName('');
    router.refresh();
  };

  return (
    <form
      onSubmit={(...args) => void handleSubmit(...args)}
      className="bg-white rounded p-4 mb-6 flex gap-2 items-end flex-wrap"
    >
      {error && <p className="text-sm text-red-700 w-full">{error}</p>}
      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Nom de la cave</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Propriétaire</label>
        <select
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
          required
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="bg-forest text-cream rounded px-4 py-2 text-sm">
        Créer la cave
      </button>
    </form>
  );
};
