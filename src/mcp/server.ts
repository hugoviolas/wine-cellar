import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerBottleTools } from './registerBottleTools';
import { registerCellarTools } from './registerCellarTools';
import { registerConsumptionTools } from './registerConsumptionTools';
import { registerWishlistTools } from './registerWishlistTools';
import type { ToolContext } from './interfaces/tool-context.interface';

/**
 * Consignes générales, lues par Claude à la connexion : ce que couvre le
 * serveur, au nom de qui il agit, et les conventions communes aux tools.
 */
const INSTRUCTIONS = [
  "Cave à vin de l'utilisateur (application Ma Cave) : caves, clayettes, bouteilles de tous types (vin, effervescent, cidre, bière, spiritueux), historique de consommation et wishlist.",
  'Les tools agissent au nom du compte connecté, sur les seules caves dont il est membre, avec son rôle dans chacune : owner et editor modifient le contenu ; reader consulte, consomme une bouteille et la note. La wishlist est personnelle.',
  'Sans cellar_id, la cave par défaut est la première de list_cellars. Les identifiants (cellar_id, crate_id, bottle_id, entry_id, item_id) viennent des tools de lecture : ne jamais les inventer.',
  'Une bouteille bue se déclare avec consume_bottle (stock et historique), pas en baissant la quantité.',
  "Unités : millésimes et fenêtres de garde en années, contenance en ml, degré en % vol., notes de 0 à 5, jours au format AAAA-MM-JJ à l'heure de Paris. Dans les réponses, un champ absent est un champ non renseigné.",
].join(' ');

/**
 * Un serveur par requête : le transport est sans session, et chaque
 * serveur porte l'utilisateur du jeton qui l'a ouvert.
 */
export const createCaveMcpServer = (context: ToolContext): McpServer => {
  const server = new McpServer({ name: 'ma-cave', version: '1.0.0' }, { instructions: INSTRUCTIONS });
  registerCellarTools({ server, context });
  registerBottleTools({ server, context });
  registerConsumptionTools({ server, context });
  registerWishlistTools({ server, context });
  return server;
};
