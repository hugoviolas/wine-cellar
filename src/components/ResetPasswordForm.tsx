'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PasswordInput } from '@/components/PasswordInput';

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const passwordsMatch = password.length > 0 && password === confirmPassword;

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
      <PasswordInput
        value={password}
        onChange={setPassword}
        className="mb-3"
        minLength={8}
        required
      />
      <label className="block text-xs uppercase tracking-wide mb-1">Confirmer le mot de passe</label>
      <PasswordInput
        value={confirmPassword}
        onChange={setConfirmPassword}
        className="mb-1"
        minLength={8}
        required
      />
      {confirmPassword.length > 0 && !passwordsMatch && (
        <p className="text-xs text-red-700 mb-2">Les mots de passe ne correspondent pas.</p>
      )}
      <button
        type="submit"
        disabled={password.length < 8 || !passwordsMatch}
        className="bg-forest text-cream rounded px-4 py-2 text-sm mt-2"
      >
        Réinitialiser
      </button>
    </form>
  );
}
