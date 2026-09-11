import { db } from '@/db/client';
import { validateResetToken } from '@/domain/passwordReset';
import { ResetPasswordForm } from '@/components/ResetPasswordForm';

const STATUS_MESSAGES: Record<'not_found' | 'expired' | 'already_used', string> = {
  not_found: "Ce lien de réinitialisation n'existe pas.",
  expired: 'Ce lien de réinitialisation a expiré.',
  already_used: 'Ce lien de réinitialisation a déjà été utilisé.',
};

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lookup = await validateResetToken(db, token);

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="bg-white p-8 rounded shadow-sm w-full max-w-sm">
        <h1 className="text-xl mb-4">Ma Cave</h1>
        {lookup.status === 'valid' ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p className="text-sm">{STATUS_MESSAGES[lookup.status]}</p>
        )}
      </div>
    </div>
  );
}
