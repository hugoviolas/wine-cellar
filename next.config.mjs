/**
 * En-têtes de sécurité appliqués à toutes les réponses. Pas de
 * Content-Security-Policy ici : Next.js injecte ses propres scripts inline
 * et une CSP stricte demande un nonce par requête (donc un middleware) —
 * à faire dans un second temps, sans bloquer ces en-têtes-là.
 */
const securityHeaders = [
  // L'app ne s'affiche jamais dans une iframe : personne ne peut la
  // superposer à une page piège pour faire cliquer sur ses boutons.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  // Empêche le navigateur de deviner un type MIME différent de celui annoncé.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Les URL contiennent des jetons (invitation, réinitialisation) : ne
  // jamais les envoyer en Referer vers un autre site.
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.1.74'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
