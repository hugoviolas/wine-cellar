'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function InviteMemberForm({ cellarId }: { cellarId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'reader'>('editor');
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLink(null);
    const response = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cellarId, email, role }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'Impossible de créer l’invitation.');
      return;
    }
    const data = await response.json();
    setLink(`${window.location.origin}/invitations/${data.token}`);
    setEmail('');
    router.refresh();
  }

  return (
    <div className="bg-white rounded p-4 mb-6">
      <h3 className="text-sm mb-3">Inviter un membre</h3>
      {error && <p className="text-sm text-red-700 mb-2">{error}</p>}
      <form onSubmit={handleSubmit} className="flex gap-2 items-end flex-wrap">
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Rôle</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'editor' | 'reader')}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="editor">Éditeur</option>
            <option value="reader">Lecteur</option>
          </select>
        </div>
        <button type="submit" className="bg-forest text-cream rounded px-4 py-2 text-sm">
          Créer l’invitation
        </button>
      </form>
      {link && (
        <div className="mt-3 text-sm">
          <p className="text-xs text-gray-500 mb-1">
            Lien à copier et transmettre toi-même (valable 7 jours) :
          </p>
          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="w-full border border-gray-300 rounded px-3 py-2 text-xs bg-gray-50"
          />
        </div>
      )}
    </div>
  );
}
