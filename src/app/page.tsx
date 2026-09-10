import { redirect } from 'next/navigation';
import { getSession } from '@/domain/session';

// Cette page lit la session — jamais de pré-rendu statique à la
// construction (qui l'exécuterait sans requête réelle, avant même qu'un
// SESSION_SECRET soit disponible dans un environnement comme une image
// Docker construite sans .env).
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getSession();
  if (session.userId) redirect('/accueil');

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="bg-white p-8 rounded shadow-sm w-full max-w-sm text-center">
        <h1 className="text-2xl font-serif italic mb-2">Ma Cave</h1>
        <p className="text-sm text-gray-500 mb-6">
          Gère ta cave à vin, champagne et autres alcools : clayettes, fenêtres de garde,
          historique de consommation.
        </p>
        <a
          href="/login"
          className="inline-block bg-forest text-cream rounded px-4 py-2 text-sm"
        >
          Se connecter
        </a>
        <a
          href="/signup"
          className="inline-block border border-gray-300 text-forest rounded px-4 py-2 text-sm ml-2"
        >
          Créer un compte
        </a>
      </div>
    </div>
  );
}
