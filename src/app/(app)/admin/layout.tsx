import Link from 'next/link';
import { requireSuperAdmin } from '@/lib/requireSuperAdmin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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
}
