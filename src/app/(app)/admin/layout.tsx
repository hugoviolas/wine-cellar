import Link from 'next/link';
import { requireSuperAdmin } from '@/lib/requireSuperAdmin';
import type { ReactElement } from 'react';

const AdminLayout = async ({ children }: { children: React.ReactNode }): Promise<ReactElement> => {
  await requireSuperAdmin();

  return (
    <div>
      <nav className="flex gap-4 text-xs uppercase tracking-wide mb-6 border-b border-gray-200 pb-3">
        <Link href="/admin/utilisateurs">Utilisateurs</Link>
        <Link href="/admin/caves">Caves</Link>
        <Link href="/admin/reglages">Réglages</Link>
      </nav>
      {children}
    </div>
  );
};

export default AdminLayout;
