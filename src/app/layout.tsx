import type { Metadata } from 'next';
import './globals.css';
import type { ReactElement } from 'react';

export const metadata: Metadata = {
  title: 'Ma Cave',
  description: 'Gestion de cave à vin, champagne et autres alcools',
};

const RootLayout = ({ children }: { children: React.ReactNode }): ReactElement => {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
};

export default RootLayout;
