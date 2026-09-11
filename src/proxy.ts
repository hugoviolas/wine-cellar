import { NextResponse, type NextRequest } from 'next/server';

/**
 * Vérification d'origine sur les requêtes qui modifient quelque chose.
 *
 * Le cookie de session est déjà en `SameSite=Lax` (défaut iron-session,
 * conservé malgré nos `cookieOptions` — vérifié dans le paquet), ce qui
 * empêche déjà un site tiers de le joindre à un POST. Et nos routes lisent
 * toutes `request.json()`, qu'un `<form>` cross-site ne peut pas produire.
 * Cette vérification est donc une deuxième barrière, pas la première : elle
 * couvre le cas où l'une de ces deux protections sauterait sans qu'on y
 * prenne garde (un `sameSite: 'none'` ajouté un jour, une route qui se met
 * à accepter un formulaire).
 *
 * Convention `proxy` et non `middleware` : cette dernière est dépréciée
 * depuis Next 16 (le build émet un avertissement), même emplacement et
 * même signature, seul le nom de la fonction change.
 *
 * Volontairement permissive sur l'absence d'en-tête : un client non
 * navigateur (curl, un script, une future app mobile) n'envoie pas
 * d'`Origin`, et rien ne justifie de le casser — un attaquant CSRF passe
 * forcément par un navigateur, qui lui en envoie un.
 */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function proxy(request: NextRequest) {
  if (!MUTATING_METHODS.has(request.method)) {
    return NextResponse.next();
  }

  const origin = request.headers.get('origin');
  if (!origin) return NextResponse.next();

  // `host` est celui que voit le navigateur : le domaine public derrière le
  // tunnel Cloudflare en production, `ip:3001` en préprod sur le LAN. Dans
  // les deux cas il correspond à l'origine d'une requête légitime issue de
  // l'app elle-même.
  const host = request.headers.get('host');
  if (!host) return NextResponse.next();

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json({ error: 'Origine invalide.' }, { status: 403 });
  }

  if (originHost !== host) {
    return NextResponse.json({ error: 'Origine non autorisée.' }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  // Exclut les assets statiques et l'optimiseur d'images : rien n'y est
  // modifiable, et les faire passer par le middleware ne ferait que
  // ralentir chaque chargement de page.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
