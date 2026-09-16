import { randomUUID } from 'node:crypto';

export const newId = (): string => {
  return randomUUID();
};
