import type { LogFields } from './log-fields.interface';

export interface WriteArgs {
  readonly level: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly fields?: LogFields;
}
