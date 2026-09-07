import { db } from '@/db/client';
import { getAppSettings } from '@/domain/appSettings';
import { RegistrationToggle } from '@/components/RegistrationToggle';

export default async function AdminSettingsPage() {
  const settings = await getAppSettings(db);

  return (
    <div>
      <h2 className="text-lg mb-4">Réglages</h2>
      <RegistrationToggle initialEnabled={settings.registrationEnabled} />
    </div>
  );
}
