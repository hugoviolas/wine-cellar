import { db } from '@/db/client';
import { getAppSettings } from '@/domain/appSettings';
import { SignupForm } from '@/components/SignupForm';

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
