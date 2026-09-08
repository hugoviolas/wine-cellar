import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { checkCellarAccess } from '@/domain/access';
import { canManageCellar } from '@/domain/permissions';
import { resolveViewedCellarId } from '@/domain/viewedCellar';
import { listCellarMembersWithEmail } from '@/domain/cellarMembers';
import { getCellarById } from '@/domain/cellars';
import { InviteMemberForm } from '@/components/InviteMemberForm';
import { MembersList } from '@/components/MembersList';
import { CellarInfoForm } from '@/components/CellarInfoForm';

export default async function CaveParametresPage({
  searchParams,
}: {
  searchParams: Promise<{ cellarId?: string }>;
}) {
  const user = await requireUser();
  const { cellarId: requestedCellarId } = await searchParams;
  const cellarId = await resolveViewedCellarId(db, user.id, requestedCellarId);

  if (!cellarId) {
    return <p className="text-sm">Aucune cave associée à ce compte.</p>;
  }

  const access = await checkCellarAccess(db, user.id, cellarId);
  if (!access.allowed || !canManageCellar(access.role)) {
    redirect('/cave');
  }

  const members = await listCellarMembersWithEmail(db, cellarId);
  const cellar = await getCellarById(db, cellarId);

  return (
    <div className="max-w-xl">
      <h2 className="text-lg mb-4">Gérer la cave</h2>
      {cellar && (
        <CellarInfoForm
          cellarId={cellarId}
          initialBrand={cellar.brand}
          initialModel={cellar.model}
          initialNotes={cellar.notes}
        />
      )}
      <InviteMemberForm cellarId={cellarId} />
      <h3 className="text-sm mb-3">Membres</h3>
      <MembersList initialMembers={members} />
    </div>
  );
}
