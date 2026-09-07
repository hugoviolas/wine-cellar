import { db } from '@/db/client';
import { getSession } from '@/domain/session';
import { getInvitationByToken } from '@/domain/invitations';
import { getAppSettings } from '@/domain/appSettings';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AcceptInvitationForm } from '@/components/AcceptInvitationForm';

const STATUS_MESSAGES: Record<'not_found' | 'expired' | 'already_used', string> = {
  not_found: "Ce lien d'invitation n'existe pas.",
  expired: 'Ce lien d’invitation a expiré.',
  already_used: 'Cette invitation a déjà été utilisée.',
};

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lookup = await getInvitationByToken(db, token);

  if (lookup.status !== 'valid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="bg-white p-8 rounded shadow-sm max-w-sm text-center">
          <p className="text-sm">{STATUS_MESSAGES[lookup.status]}</p>
        </div>
      </div>
    );
  }

  const session = await getSession();
  let currentUserEmail: string | null = null;
  if (session.userId) {
    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (user) currentUserEmail = user.email;
  }

  const settings = await getAppSettings(db);
  const canSignUp = currentUserEmail !== null || settings.registrationEnabled;

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="bg-white p-8 rounded shadow-sm w-full max-w-sm">
        <h1 className="text-xl mb-2">Ma Cave</h1>
        <p className="text-sm mb-4">
          Tu es invité·e à rejoindre une cave en tant que{' '}
          <strong>{lookup.invitation.role === 'editor' ? 'éditeur' : 'lecteur'}</strong>.
        </p>
        {canSignUp ? (
          <AcceptInvitationForm
            token={token}
            email={lookup.invitation.email}
            currentUserEmail={currentUserEmail}
          />
        ) : (
          <p className="text-sm">
            Les inscriptions sont actuellement fermées. Contacte l’administrateur qui pourra créer
            ton compte.
          </p>
        )}
      </div>
    </div>
  );
}
