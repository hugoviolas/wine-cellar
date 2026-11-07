import { z } from 'zod';
import { BottleUnavailableError, consumeBottle } from '@/domain/consume';
import {
  deleteHistoryEntry,
  listConsumptionHistory,
  updateHistoryEntry,
  type UpdateHistoryEntryInput,
} from '@/domain/history';
import { parisDay } from '@/domain/parisDate';
import { requireEditor, resolveBottle, resolveCellar, resolveHistoryEntry } from './access';
import { presentConsumption } from './presenters';
import {
  bottleIdField,
  cellarIdField,
  clearable,
  commentField,
  dayField,
  entryIdField,
  occasionField,
  pageFields,
  ratingField,
} from './schemas';
import { ToolError, runTool } from './toolResult';
import type { RegisterToolsArgs } from './interfaces/register-tools-args.interface';

const DEFAULT_PAGE_SIZE = 50;

export const registerConsumptionTools = ({ server, context }: RegisterToolsArgs): void => {
  const { db, user } = context;

  server.registerTool(
    'consume_bottle',
    {
      title: 'Consommer une bouteille',
      description:
        "Enregistre qu'une ou plusieurs bouteilles ont été bues : le stock baisse d'autant et la consommation entre dans l'historique, avec la note, le commentaire de dégustation et l'occasion. Ouvert à tout membre de la cave, y compris reader. Refusé si le stock ne suffit pas.",
      inputSchema: {
        bottle_id: bottleIdField,
        quantity: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('Nombre de bouteilles bues (1 par défaut).'),
        consumed_at: dayField
          .optional()
          .describe("Jour de la consommation, AAAA-MM-JJ, heure de Paris. Par défaut : aujourd'hui."),
        rating: ratingField.optional(),
        comment: commentField.optional().describe('Commentaire de dégustation.'),
        occasion: occasionField.optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    (input) => {
      return runTool({
        tool: 'consume_bottle',
        work: async () => {
          const { bottle } = await resolveBottle({ context, id: input.bottle_id });
          const quantity = input.quantity ?? 1;
          const consumedAt = input.consumed_at ?? parisDay();
          let entryId: string;
          try {
            entryId = await consumeBottle({
              db,
              input: {
                bottleId: bottle.id,
                consumedByUserId: user.id,
                consumedAt,
                quantity,
                rating: input.rating,
                comment: input.comment,
                occasion: input.occasion,
              },
            });
          } catch (error: unknown) {
            if (error instanceof BottleUnavailableError) {
              throw new ToolError(
                `Stock insuffisant : il reste ${bottle.quantity} bouteille(s) de « ${bottle.name} ».`,
              );
            }
            throw error;
          }
          return {
            entry_id: entryId,
            consumed_at: consumedAt,
            quantity,
            bottle: {
              bottle_id: bottle.id,
              name: bottle.name,
              remaining_quantity: bottle.quantity - quantity,
            },
          };
        },
      });
    },
  );

  server.registerTool(
    'list_consumptions',
    {
      title: 'Historique de consommation',
      description:
        "Historique des bouteilles bues dans une cave, de la plus récente à la plus ancienne : jour, quantité, note, commentaire de dégustation, occasion, et la bouteille telle qu'elle était alors (nom, producteur, millésime). by_me indique ce que l'utilisateur connecté a enregistré lui-même. bottle_id n'est présent que si la bouteille est encore en cave.",
      inputSchema: {
        cellar_id: cellarIdField,
        from: dayField.optional().describe('Premier jour inclus, AAAA-MM-JJ.'),
        to: dayField.optional().describe('Dernier jour inclus, AAAA-MM-JJ.'),
        ...pageFields,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (input) => {
      return runTool({
        tool: 'list_consumptions',
        work: async () => {
          const { cellar } = await resolveCellar({ context, cellarId: input.cellar_id });
          const { from, to } = input;
          // `consumed_at` est un jour AAAA-MM-JJ : l'ordre des chaînes est
          // celui du calendrier, et le préfixe suffit à couvrir une valeur
          // plus précise saisie autrement.
          const entries = (await listConsumptionHistory({ db, cellarId: cellar.id })).filter(
            (entry) =>
              (from === undefined || entry.consumedAt.slice(0, 10) >= from) &&
              (to === undefined || entry.consumedAt.slice(0, 10) <= to),
          );
          const offset = input.offset ?? 0;
          const page = entries.slice(offset, offset + (input.limit ?? DEFAULT_PAGE_SIZE));
          const nextOffset = offset + page.length;
          return {
            cellar_id: cellar.id,
            total: entries.length,
            bottles_consumed: entries.reduce((sum, entry) => sum + entry.quantity, 0),
            entries: page.map((entry) =>
              presentConsumption({ entry, bottleReachable: entry.bottleReachable !== null, userId: user.id }),
            ),
            next_offset: nextOffset < entries.length ? nextOffset : null,
          };
        },
      });
    },
  );

  server.registerTool(
    'update_consumption',
    {
      title: 'Modifier une consommation',
      description:
        "Corrige une entrée de l'historique (jour, quantité, note, commentaire, occasion). Seuls les champs fournis changent ; null efface. Changer la quantité ne modifie pas le stock de la bouteille. Réservé à owner et editor.",
      inputSchema: {
        entry_id: entryIdField,
        consumed_at: dayField.optional(),
        quantity: z.number().int().min(1).max(100).optional().describe('Nombre de bouteilles bues.'),
        rating: clearable(ratingField),
        comment: clearable(commentField),
        occasion: clearable(occasionField),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ entry_id: entryId, ...input }) => {
      return runTool({
        tool: 'update_consumption',
        work: async () => {
          const { role } = await resolveHistoryEntry({ context, id: entryId });
          requireEditor(role);
          const patch: UpdateHistoryEntryInput = {};
          if (input.consumed_at !== undefined) {
            patch.consumedAt = input.consumed_at;
          }
          if (input.quantity !== undefined) {
            patch.quantity = input.quantity;
          }
          if (input.rating !== undefined) {
            patch.rating = input.rating;
          }
          if (input.comment !== undefined) {
            patch.comment = input.comment;
          }
          if (input.occasion !== undefined) {
            patch.occasion = input.occasion;
          }
          if (Object.keys(patch).length === 0) {
            throw new ToolError('Aucun champ à modifier.');
          }
          await updateHistoryEntry({ db, entryId, input: patch });
          const { entry } = await resolveHistoryEntry({ context, id: entryId });
          return presentConsumption({ entry, bottleReachable: entry.bottleId !== null, userId: user.id });
        },
      });
    },
  );

  server.registerTool(
    'delete_consumption',
    {
      title: 'Supprimer une consommation',
      description:
        "Supprime définitivement une entrée de l'historique. Ne remet pas la bouteille en stock : pour annuler une consommation enregistrée par erreur, remonter aussi la quantité avec update_bottle. Réservé à owner et editor.",
      inputSchema: { entry_id: entryIdField },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    ({ entry_id: entryId }) => {
      return runTool({
        tool: 'delete_consumption',
        work: async () => {
          const { entry, role } = await resolveHistoryEntry({ context, id: entryId });
          requireEditor(role);
          await deleteHistoryEntry({ db, entryId });
          return {
            deleted: true,
            entry_id: entryId,
            bottle_id: entry.bottleId,
            name: entry.bottleNameSnapshot,
          };
        },
      });
    },
  );
};
