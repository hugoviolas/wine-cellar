import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { getUserById } from '@/domain/admin';
import { AdminUserDetail } from '@/components/AdminUserDetail';

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserById(db, id);
  if (!user) notFound();

  return (
    <div>
      <h2 className="text-lg mb-4">{user.email}</h2>
      <AdminUserDetail
        user={{
          id: user.id,
          email: user.email,
          isActive: user.isActive,
          isSuperAdmin: user.isSuperAdmin,
        }}
      />
    </div>
  );
}
