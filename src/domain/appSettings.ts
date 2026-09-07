import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { appSettings } from '../db/schema';

const SETTINGS_ID = 'singleton';

export async function getAppSettings(db: Db): Promise<{ registrationEnabled: boolean }> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.id, SETTINGS_ID)).limit(1);
  if (row) return row;
  const defaults = { id: SETTINGS_ID, registrationEnabled: true };
  await db.insert(appSettings).values(defaults);
  return defaults;
}
