import Link from 'next/link';
import { requireUser } from '@/lib/requireUser';

// Toutes les pages protégées lisent la session utilisateur — jamais de
// pré-rendu statique à la construction (qui exécuterait ce layout sans
// requête réelle, avant même qu'un SESSION_SECRET soit disponible dans un
// environnement comme une image Docker construite sans .env).
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div>
      <header className="bg-forest text-cream px-5 py-4 flex items-center justify-between">
        <span className="font-serif italic text-lg">Ma Cave</span>
        <nav className="flex gap-4 text-xs uppercase tracking-wide">
          <Link href="/cave">Cave</Link>
          <Link href="/historique">Historique</Link>
          {user.isSuperAdmin && <Link href="/admin/utilisateurs">Admin</Link>}
          <form action="/api/auth/logout" method="post">
            <button type="submit">Déconnexion</button>
          </form>
        </nav>
      </header>
      <main className="p-4 max-w-5xl mx-auto">{children}</main>
    </div>
  );
}
