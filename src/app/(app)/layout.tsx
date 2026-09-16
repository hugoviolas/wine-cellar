import Link from 'next/link';
import { requireUser } from '@/lib/requireUser';
import { ToastProvider } from '@/components/Toast';
import { MobileNav } from '@/components/MobileNav';
import type { ReactElement } from 'react';

// Toutes les pages protégées lisent la session utilisateur — jamais de
// pré-rendu statique à la construction (qui exécuterait ce layout sans
// requête réelle, avant même qu'un SESSION_SECRET soit disponible dans un
// environnement comme une image Docker construite sans .env).
export const dynamic = 'force-dynamic';

const AppLayout = async ({ children }: { children: React.ReactNode }): Promise<ReactElement> => {
  const user = await requireUser();

  return (
    <ToastProvider>
      <div>
        <header className="bg-forest text-cream px-5 py-4 flex items-center justify-between relative">
          <Link href="/accueil" className="font-serif italic text-lg">
            Ma Cave
          </Link>
          <MobileNav isSuperAdmin={user.isSuperAdmin} />
        </header>
        <main className="p-4 max-w-5xl mx-auto">{children}</main>
      </div>
    </ToastProvider>
  );
};

export default AppLayout;
