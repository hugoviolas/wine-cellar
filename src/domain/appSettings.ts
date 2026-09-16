import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { appSettings } from '../db/schema';
import type { SetRegistrationEnabledArgs } from './interfaces/set-registration-enabled-args.interface';

const SETTINGS_ID = 'singleton';

export const getAppSettings = async (db: Db): Promise<{ registrationEnabled: boolean }> => {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.id, SETTINGS_ID)).limit(1);
  if (row) {
    return row;
  }
  const defaults = { id: SETTINGS_ID, registrationEnabled: true };
  await db.insert(appSettings).values(defaults);
  return defaults;
};

export const setRegistrationEnabled = async ({ db, enabled }: SetRegistrationEnabledArgs): Promise<void> => {
  await getAppSettings(db);
  await db.update(appSettings).set({ registrationEnabled: enabled }).where(eq(appSettings.id, SETTINGS_ID));
};
