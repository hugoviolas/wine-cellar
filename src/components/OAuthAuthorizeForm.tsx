'use client';

import { useState } from 'react';
import { PasswordInput } from '@/components/PasswordInput';
import { errorMessageFromResponse } from '@/lib/apiError';
import { readJsonBody } from '@/lib/readJsonBody';
import type { ReactElement } from 'react';
import type { OAuthAuthorizeFormProps } from './interfaces/oauth-authorize-form-props.interface';

const redirectUrlFrom = (body: unknown): string | null => {
  if (typeof body === 'object' && body !== null && 'redirectUrl' in body) {
    const { redirectUrl } = body;
    return typeof redirectUrl === 'string' ? redirectUrl : null;
  }
  return null;
};

export const OAuthAuthorizeForm = ({
  params,
  clientName,
  redirectHost,
}: OAuthAuthorizeFormProps): ReactElement => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch('/api/oauth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, params }),
      });
      if (!response.ok) {
        setError(await errorMessageFromResponse({ response, fallback: 'Une erreur est survenue' }));
        setBusy(false);
        return;
      }
      const redirectUrl = redirectUrlFrom(await readJsonBody(response));
      if (!redirectUrl) {
        setError('Réponse inattendue du serveur.');
        setBusy(false);
        return;
      }
      // Navigation complète, pas `router.push` : la suite se passe chez
      // l'application qui a demandé l'accès. `busy` reste vrai jusque-là
      // pour qu'un second clic n'émette pas un second code.
      window.location.assign(redirectUrl);
    } catch {
      setError('Impossible de contacter le serveur — vérifie ta connexion et réessaie.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(...args) => void handleSubmit(...args)}>
      <p className="text-sm mb-2">
        <strong>{clientName ?? 'Une application'}</strong> demande l’accès à ta cave.
      </p>
      <p className="text-xs text-gray-600 mb-5">
        Elle pourra consulter et modifier tes caves, ton historique et ta wishlist, avec les mêmes droits que
        toi. L’autorisation sera renvoyée à <strong>{redirectHost}</strong>. Si tu n’es pas à l’origine de
        cette demande, ferme cette page.
      </p>
      {error && <p className="text-sm text-red-700 mb-4">{error}</p>}
      <label className="block text-xs uppercase tracking-wide mb-1">Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm"
        autoComplete="username"
        required
      />
      <label className="block text-xs uppercase tracking-wide mb-1">Mot de passe</label>
      <PasswordInput value={password} onChange={setPassword} className="mb-6" required />
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-forest text-cream rounded py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Autoriser l’accès
      </button>
    </form>
  );
};
