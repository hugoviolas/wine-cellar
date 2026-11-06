import { listBottlesByCellar, listActiveBottlesByCellar } from '@/domain/bottles';
import { listMemberCellars, summarizeCellar } from '@/domain/cellarOverview';
import { listCrates } from '@/domain/crates';
import { parisYear } from '@/domain/parisDate';
import { resolveCellar } from './access';
import { presentCrateRef } from './presenters';
import { cellarIdField } from './schemas';
import { runTool } from './toolResult';
import type { RegisterToolsArgs } from './interfaces/register-tools-args.interface';

export const registerCellarTools = ({ server, context }: RegisterToolsArgs): void => {
  server.registerTool(
    'list_cellars',
    {
      title: 'Lister les caves',
      description:
        "Liste les caves de l'utilisateur avec son rôle dans chacune — owner (propriétaire) et editor peuvent tout modifier ; reader peut consulter, consommer une bouteille et la noter — et le nombre de bouteilles en stock. La première (is_default) est celle qu'utilisent les autres tools quand cellar_id est omis.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () => {
      return runTool({
        tool: 'list_cellars',
        work: async () => {
          const memberships = await listMemberCellars({ db: context.db, userId: context.user.id });
          const cellars = [];
          for (const [index, { cellar, role }] of memberships.entries()) {
            const rows = await listActiveBottlesByCellar({ db: context.db, cellarId: cellar.id });
            cellars.push({
              cellar_id: cellar.id,
              name: cellar.name,
              role,
              is_default: index === 0,
              bottles: rows.reduce((sum, { bottle }) => sum + bottle.quantity, 0),
              references: rows.length,
            });
          }
          return { cellars };
        },
      });
    },
  );

  server.registerTool(
    'get_cellar_overview',
    {
      title: "Vue d'ensemble d'une cave",
      description:
        "Synthèse d'une cave : bouteilles en stock et capacité, répartition par catégorie, couleur, statut de garde (too_young : trop jeune ; ready : à boire ; closing_window : fin de fenêtre, à boire bientôt ; unknown : fenêtre inconnue) et région, millésimes extrêmes, et chaque clayette avec son occupation (crate_id à utiliser pour ranger une bouteille). Les comptes sont des bouteilles (quantités), pas des références.",
      inputSchema: { cellar_id: cellarIdField },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ cellar_id: cellarId }) => {
      return runTool({
        tool: 'get_cellar_overview',
        work: async () => {
          const { cellar, role } = await resolveCellar({ context, cellarId });
          const currentYear = parisYear();
          const summary = summarizeCellar({
            rows: await listBottlesByCellar({ db: context.db, cellarId: cellar.id }),
            crates: await listCrates({ db: context.db, cellarId: cellar.id }),
            currentYear,
          });
          return {
            cellar_id: cellar.id,
            name: cellar.name,
            brand: cellar.brand,
            model: cellar.model,
            notes: cellar.notes,
            role,
            current_year: currentYear,
            bottles: summary.bottles,
            references: summary.references,
            finished_references: summary.finishedReferences,
            capacity: summary.capacity,
            by_category: summary.byCategory,
            by_color: summary.byColor,
            by_garde_status: summary.byGardeStatus,
            top_regions: summary.topRegions,
            other_regions_bottles: summary.otherRegionsBottles,
            oldest_vintage: summary.oldestVintage,
            newest_vintage: summary.newestVintage,
            crates: summary.crates.map(({ crate, bottles, references }) => ({
              ...presentCrateRef(crate),
              capacity: crate.capacity,
              bottles,
              references,
            })),
          };
        },
      });
    },
  );
};
