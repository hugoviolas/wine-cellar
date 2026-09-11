'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PasswordInput } from '@/components/PasswordInput';

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const passwordsMatch = password.length > 0 && password === confirmPassword;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? 'Impossible de créer ton compte.');
        return;
      }
      router.push('/accueil');
      router.refresh();
    } catch {
      setError('Impossible de contacter le serveur — vérifie ta connexion et réessaie.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="text-sm text-red-700 mb-3">{error}</p>}

      <label className="block text-xs uppercase tracking-wide mb-1">Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm"
        required
      />

      <label className="block text-xs uppercase tracking-wide mb-1">Mot de passe</label>
      <PasswordInput
        value={password}
        onChange={setPassword}
        className="mb-3"
        placeholder="8 caractères minimum"
        minLength={8}
        required
      />

      <label className="block text-xs uppercase tracking-wide mb-1">Confirmer le mot de passe</label>
      <PasswordInput
        value={confirmPassword}
        onChange={setConfirmPassword}
        className="mb-1"
        required
      />
      {confirmPassword.length > 0 && !passwordsMatch && (
        <p className="text-xs text-red-700 mb-2">Les mots de passe ne correspondent pas.</p>
      )}
      {password.length > 0 && password.length < 8 && (
        <p className="text-xs text-red-700 mb-2">Le mot de passe doit faire au moins 8 caractères.</p>
      )}

      <button
        type="submit"
        disabled={busy || password.length < 8 || !passwordsMatch}
        className="w-full bg-forest text-cream rounded py-2 text-sm mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Créer mon compte
      </button>

      <p className="text-xs text-gray-500 mt-4 text-center">
        Déjà un compte ? <a href="/login" className="underline">Connecte-toi</a>
      </p>
    </form>
  );
}
