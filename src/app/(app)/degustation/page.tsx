import { TastingMemo } from '@/components/TastingMemo';
import { requireUser } from '@/lib/requireUser';
import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export const metadata: Metadata = {
  title: 'Mémo de dégustation',
};

// Page de référence : aucun contenu de cave, rien à charger. Elle n'exige
// qu'une session, comme le reste de l'espace connecté.
const DegustationPage = async (): Promise<ReactElement> => {
  await requireUser();

  return (
    <div>
      <h2 className="text-lg mb-1">Mémo de dégustation</h2>
      <p className="text-sm text-gray-500 mb-4">
        Regarder, sentir, goûter, conclure — les repères, rien de plus.
      </p>
      <TastingMemo />
    </div>
  );
};

export default DegustationPage;
