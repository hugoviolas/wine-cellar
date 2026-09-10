import { db } from '@/db/client';
import { getAppSettings } from '@/domain/appSettings';
import { SignupForm } from '@/components/SignupForm';

// Cette page lit les paramètres de l'application en base — jamais de
// pré-rendu statique à la construction (qui exécuterait cette page sans
// requête réelle, avant même que le répertoire data/ existe dans un
// environnement comme une image Docker construite sans data/).
export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  const settings = await getAppSettings(db);

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="bg-white p-8 rounded shadow-sm w-full max-w-sm">
        <h1 className="text-xl mb-6">Ma Cave</h1>
        {settings.registrationEnabled ? (
          <SignupForm />
        ) : (
          <p className="text-sm text-gray-500">
            Les inscriptions sont actuellement fermées. Contacte l&apos;administrateur qui pourra créer
            ton compte.
          </p>
        )}
      </div>
    </div>
  );
}
