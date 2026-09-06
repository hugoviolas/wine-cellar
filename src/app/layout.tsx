import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ma Cave',
  description: 'Gestion de cave à vin, champagne et autres alcools',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
