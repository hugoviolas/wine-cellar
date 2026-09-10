'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PasswordInput } from '@/components/PasswordInput';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'Une erreur est survenue');
      return;
    }
    router.push('/accueil');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-sm w-full max-w-sm">
        <h1 className="text-xl mb-6">Ma Cave</h1>
        {error && <p className="text-sm text-red-700 mb-4">{error}</p>}
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
          className="mb-6"
          required
        />
        <button type="submit" className="w-full bg-forest text-cream rounded py-2 text-sm">
          Se connecter
        </button>
        <p className="text-xs text-gray-500 mt-4 text-center">
          Pas de compte ? <a href="/signup" className="underline">Crée-en un</a>
        </p>
      </form>
    </div>
  );
}
