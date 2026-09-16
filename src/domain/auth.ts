import bcrypt from 'bcryptjs';
import type { VerifyPasswordArgs } from './interfaces/verify-password-args.interface';

const SALT_ROUNDS = 12;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const verifyPassword = async ({ password, hash }: VerifyPasswordArgs): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};
