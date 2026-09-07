import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { checkCellarAccess } from '@/domain/access';
import { canManageCellar } from '@/domain/permissions';
import { cellarMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { listCellarMembersWithEmail } from '@/domain/cellarMembers';
import { InviteMemberForm } from '@/components/InviteMemberForm';
import { MembersList } from '@/components/MembersList';

export default async function CaveParametresPage() {
  const user = await requireUser();
  const [membership] = await db
    .select()
    .from(cellarMemberships)
    .where(eq(cellarMemberships.userId, user.id))
    .orderBy(cellarMemberships.createdAt)
    .limit(1);

  if (!membership) {
    return <p className="text-sm">Aucune cave associée à ce compte.</p>;
  }

  const access = await checkCellarAccess(db, user.id, membership.cellarId);
  if (!access.allowed || !canManageCellar(access.role)) {
    redirect('/cave');
  }

  const members = await listCellarMembersWithEmail(db, membership.cellarId);

  return (
    <div className="max-w-xl">
      <h2 className="text-lg mb-4">Réglages de la cave</h2>
      <InviteMemberForm cellarId={membership.cellarId} />
      <h3 className="text-sm mb-3">Membres</h3>
      <MembersList initialMembers={members} />
    </div>
  );
}
