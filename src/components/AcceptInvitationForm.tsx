'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AcceptInvitationForm({
  token,
  email,
  currentUserEmail,
}: {
  token: string;
  email: string;
  currentUserEmail: string | null;
}) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(mode: 'login' | 'signup') {
    setError(null);
    setBusy(true);
    const response = await fetch(`/api/invitations/${token}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mode === 'login' ? { mode } : { mode, password }),
    });
    setBusy(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'Impossible d’accepter l’invitation.');
      return;
    }
    router.push('/cave');
    router.refresh();
  }

  if (currentUserEmail === email) {
    return (
      <div>
        {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
        <button
          onClick={() => submit('login')}
          disabled={busy}
          className="bg-forest text-cream rounded px-4 py-2 text-sm"
        >
          Rejoindre la cave
        </button>
      </div>
    );
  }

  if (currentUserEmail && currentUserEmail !== email) {
    return (
      <div className="text-sm">
        <p className="mb-3">
          Cette invitation est destinée à <strong>{email}</strong>, mais tu es connecté avec{' '}
          <strong>{currentUserEmail}</strong>.
        </p>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="text-forest underline text-xs">
            Se déconnecter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
      <label className="block text-xs uppercase tracking-wide mb-1">Mot de passe</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-3"
        placeholder="Choisis un mot de passe (8 caractères minimum)"
        minLength={8}
        required
      />
      <button
        onClick={() => submit('signup')}
        disabled={busy || password.length < 8}
        className="bg-forest text-cream rounded px-4 py-2 text-sm"
      >
        Créer mon compte et rejoindre
      </button>
      <p className="text-xs text-gray-500 mt-2">
        Un compte existe déjà pour {email} ? <a href="/login" className="underline">Connecte-toi</a> puis
        reviens sur ce lien.
      </p>
    </div>
  );
}
