import Link from 'next/link';
import { requireUser } from '@/lib/requireUser';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div>
      <header className="bg-forest text-cream px-5 py-4 flex items-center justify-between">
        <span className="font-serif italic text-lg">Ma Cave</span>
        <nav className="flex gap-4 text-xs uppercase tracking-wide">
          <Link href="/cave">Cave</Link>
          <Link href="/historique">Historique</Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit">Déconnexion</button>
          </form>
        </nav>
      </header>
      <main className="p-4 max-w-5xl mx-auto">{children}</main>
    </div>
  );
}
