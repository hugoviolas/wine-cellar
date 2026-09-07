'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch(`/api/reset-password/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'Impossible de réinitialiser le mot de passe.');
      return;
    }
    setDone(true);
    setTimeout(() => router.push('/login'), 1500);
  }

  if (done) {
    return <p className="text-sm">Mot de passe mis à jour. Redirection vers la connexion…</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
      <label className="block text-xs uppercase tracking-wide mb-1">Nouveau mot de passe</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-3"
        minLength={8}
        required
      />
      <button type="submit" className="bg-forest text-cream rounded px-4 py-2 text-sm">
        Réinitialiser
      </button>
    </form>
  );
}
