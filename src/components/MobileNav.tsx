'use client';

import { useState } from 'react';
import Link from 'next/link';

interface NavLink {
  href: string;
  label: string;
}

export function MobileNav({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [open, setOpen] = useState(false);

  const links: NavLink[] = [
    { href: '/accueil', label: 'Accueil' },
    { href: '/cave', label: 'Cave' },
    { href: '/wishlist', label: 'Wishlist' },
    { href: '/historique', label: 'Historique' },
    ...(isSuperAdmin ? [{ href: '/admin/utilisateurs', label: 'Admin' }] : []),
  ];

  return (
    <>
      <nav className="hidden sm:flex gap-4 text-xs uppercase tracking-wide items-center">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>{link.label}</Link>
        ))}
        <form action="/api/auth/logout" method="post">
          <button type="submit">Déconnexion</button>
        </form>
      </nav>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="sm:hidden text-xs uppercase tracking-wide border border-cream rounded px-3 py-1.5"
        aria-expanded={open}
        aria-label="Menu"
      >
        Menu
      </button>

      {open && (
        <div className="sm:hidden absolute top-full left-0 right-0 bg-forest text-cream px-5 py-4 flex flex-col gap-3 text-xs uppercase tracking-wide z-50 shadow-md">
          {links.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <form action="/api/auth/logout" method="post">
            <button type="submit" onClick={() => setOpen(false)}>Déconnexion</button>
          </form>
        </div>
      )}
    </>
  );
}
