import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Le runner CI self-hosted (Raspberry Pi, ARM) est nettement plus lent
    // qu'une machine de dev : sous contention (nombreux workers de test
    // lançant du hachage bcrypt en parallèle), un test individuel peut
    // dépasser le défaut de 5000ms sans qu'il y ait de bug — voir l'échec
    // de resetPasswordWithToken en CI le 2026-09-11.
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
