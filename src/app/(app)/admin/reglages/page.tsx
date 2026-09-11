import { db } from '@/db/client';
import { requireSuperAdmin } from '@/lib/requireSuperAdmin';
import { getAppSettings } from '@/domain/appSettings';
import { RegistrationToggle } from '@/components/RegistrationToggle';

export default async function AdminSettingsPage() {
  // Voir le commentaire dans /admin/utilisateurs : la garde du layout ne
  // suffit pas à empêcher le rendu de cette page.
  await requireSuperAdmin();
  const settings = await getAppSettings(db);

  return (
    <div>
      <h2 className="text-lg mb-4">Réglages</h2>
      <RegistrationToggle initialEnabled={settings.registrationEnabled} />
    </div>
  );
}
