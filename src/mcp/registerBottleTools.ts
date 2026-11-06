import { z } from 'zod';
import {
  BottleMoveError,
  createBottle,
  deleteBottle,
  listBottlesByCellar,
  moveBottles,
  updateBottle,
  type MoveBottlesResult,
} from '@/domain/bottles';
import { isPersonalBottlePatch } from '@/domain/bottleEditing';
import { filterBottles } from '@/domain/bottleSearch';
import { countBottlesInCrate } from '@/domain/crates';
import { listBottleConsumptions } from '@/domain/history';
import { parisYear } from '@/domain/parisDate';
import { aiBottleAnalysisSchema } from '@/domain/ai/schemas';
import { saveBottleAiAnalysis } from '@/domain/ai/bottleAnalysis';
import { FIELD_MAX } from '@/domain/fieldLimits';
import { requireEditor, resolveBottle, resolveCellar, resolveCrate } from './access';
import { buildBottlePatch, checkDrinkWindow } from './patches';
import { buildDetails, checkColor } from './details';
import { presentBottleDetail, presentBottleSummary, presentCrateRef } from './presenters';
import {
  COLORS,
  GARDE_STATUSES,
  bottleDescriptionFields,
  bottleIdField,
  categoryField,
  cellarIdField,
  clearable,
  crateIdField,
  drinkWindowFields,
  pageFields,
  ratingField,
  userNoteField,
} from './schemas';
import { ToolError, runTool } from './toolResult';
import type { RegisterToolsArgs } from './interfaces/register-tools-args.interface';
import type { ResolveByIdArgs } from './interfaces/resolve-by-id-args.interface';
import type { BottleDetailView } from './interfaces/bottle-detail-view.interface';

const DEFAULT_PAGE_SIZE = 50;

const GARDE_NOTE =
  'garde_status : too_young (trop jeune), ready (à boire), closing_window (fin de fenêtre, à boire bientôt), unknown (fenêtre inconnue).';

export const registerBottleTools = (args: RegisterToolsArgs): void => {
  registerReadTools(args);
  registerWriteTools(args);
};

/** Fiche à jour d'une bouteille, relue après une écriture (et revérifiée). */
const reloadDetail = async ({ context, id }: ResolveByIdArgs): Promise<BottleDetailView> => {
  const { bottle, crate, role } = await resolveBottle({ context, id });
  return presentBottleDetail({ bottle, crate, role, currentYear: parisYear(), userId: context.user.id });
};

const registerReadTools = ({ server, context }: RegisterToolsArgs): void => {
  server.registerTool(
    'search_bottles',
    {
      title: 'Chercher des bouteilles',
      description: `Cherche dans une cave. Sans critère, liste tout le stock, rangé clayette par clayette. Tous les critères fournis doivent être satisfaits. Renvoie un résumé par bouteille (bottle_id pour les autres tools, quantité en stock, fenêtre de garde, clayette) ; get_bottle donne la fiche complète avec l'analyse et les accords mets-vin. ${GARDE_NOTE}`,
      inputSchema: {
        cellar_id: cellarIdField,
        query: z
          .string()
          .trim()
          .max(FIELD_MAX.shortText)
          .optional()
          .describe(
            "Mots à retrouver tous, dans le nom, le producteur, la région, l'appellation, les cépages, le millésime ou le nom de la clayette. Accents et majuscules ignorés.",
          ),
        category: categoryField.optional(),
        color: z.enum(COLORS).optional().describe('rouge, blanc, rose ou autre.'),
        region: z
          .string()
          .trim()
          .min(1)
          .max(FIELD_MAX.shortText)
          .optional()
          .describe('Texte contenu dans la région ou la sous-région (ex. « Bourgogne », « Médoc »).'),
        garde_status: z
          .enum(GARDE_STATUSES)
          .optional()
          .describe('Statut de garde (voir la description du tool).'),
        vintage_from: z.number().int().optional().describe('Millésime minimal, inclus.'),
        vintage_to: z.number().int().optional().describe('Millésime maximal, inclus.'),
        crate_id: crateIdField.optional(),
        include_finished: z
          .boolean()
          .optional()
          .describe(
            'Inclure les bouteilles épuisées (quantité 0), pour retrouver une bouteille déjà bue. false par défaut.',
          ),
        ...pageFields,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (input) => {
      return runTool({
        tool: 'search_bottles',
        work: async () => {
          const { cellar } = await resolveCellar({ context, cellarId: input.cellar_id });
          const currentYear = parisYear();
          const rows = await listBottlesByCellar({ db: context.db, cellarId: cellar.id });
          const matches = filterBottles({
            rows,
            currentYear,
            filters: {
              query: input.query,
              category: input.category,
              color: input.color,
              region: input.region,
              gardeStatus: input.garde_status,
              vintageFrom: input.vintage_from,
              vintageTo: input.vintage_to,
              crateId: input.crate_id,
              includeFinished: input.include_finished,
            },
          }).sort((a, b) => a.crate.sortOrder - b.crate.sortOrder || a.bottle.sortOrder - b.bottle.sortOrder);

          const offset = input.offset ?? 0;
          const page = matches.slice(offset, offset + (input.limit ?? DEFAULT_PAGE_SIZE));
          const nextOffset = offset + page.length;
          return {
            cellar_id: cellar.id,
            current_year: currentYear,
            total: matches.length,
            bottles: page.map(({ bottle, crate }) => presentBottleSummary({ bottle, crate, currentYear })),
            next_offset: nextOffset < matches.length ? nextOffset : null,
          };
        },
      });
    },
  );

  server.registerTool(
    'get_bottle',
    {
      title: "Fiche d'une bouteille",
      description: `Fiche complète d'une bouteille : description, cépages, fenêtre de garde, note et note personnelle, analyse de sommelier, accords mets-vin (pairings), conseils de service, et ses consommations passées (commentaires de dégustation compris). ${GARDE_NOTE}`,
      inputSchema: { bottle_id: bottleIdField },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ bottle_id: bottleId }) => {
      return runTool({
        tool: 'get_bottle',
        work: async () => {
          const { bottle, crate, role } = await resolveBottle({ context, id: bottleId });
          const consumptions = await listBottleConsumptions({ db: context.db, bottleId: bottle.id });
          return presentBottleDetail({
            bottle,
            crate,
            role,
            consumptions,
            currentYear: parisYear(),
            userId: context.user.id,
          });
        },
      });
    },
  );
};

const registerWriteTools = ({ server, context }: RegisterToolsArgs): void => {
  const { db } = context;

  server.registerTool(
    'add_bottle',
    {
      title: 'Ajouter une bouteille',
      description:
        "Range une nouvelle bouteille (ou plusieurs identiques, via quantity) dans une clayette. Réservé aux rôles owner et editor. La région et la sous-région sont recalées d'après l'appellation quand elle est connue. Renvoie la fiche créée et l'occupation de la clayette ; une capacité dépassée est signalée sans bloquer.",
      inputSchema: {
        crate_id: crateIdField,
        category: categoryField,
        ...bottleDescriptionFields,
        producer: bottleDescriptionFields.producer.optional(),
        vintage: bottleDescriptionFields.vintage.optional(),
        region: bottleDescriptionFields.region.optional(),
        sub_region: bottleDescriptionFields.sub_region.optional(),
        color: bottleDescriptionFields.color.optional(),
        abv: bottleDescriptionFields.abv.optional(),
        volume_ml: bottleDescriptionFields.volume_ml.optional(),
        appellation: bottleDescriptionFields.appellation.optional(),
        classification: bottleDescriptionFields.classification.optional(),
        grape_varieties: bottleDescriptionFields.grape_varieties.optional(),
        quantity: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe('Nombre de bouteilles identiques (1 par défaut).'),
        drink_from: drinkWindowFields.drink_from.optional(),
        drink_until: drinkWindowFields.drink_until.optional(),
        user_note: userNoteField.optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    (input) => {
      return runTool({
        tool: 'add_bottle',
        work: async () => {
          const { crate, role } = await resolveCrate({ context, id: input.crate_id });
          requireEditor(role);
          checkColor({ category: input.category, color: input.color });
          checkDrinkWindow({ drinkFrom: input.drink_from, drinkUntil: input.drink_until });
          const bottleId = await createBottle({
            db,
            input: {
              crateId: crate.id,
              category: input.category,
              name: input.name,
              producer: input.producer,
              vintage: input.vintage,
              region: input.region,
              subRegion: input.sub_region,
              color: input.color,
              abv: input.abv,
              volumeMl: input.volume_ml,
              quantity: input.quantity ?? 1,
              drinkFrom: input.drink_from,
              drinkUntil: input.drink_until,
              userNote: input.user_note,
              details: buildDetails({ category: input.category, current: {}, input }),
            },
          });
          const occupied = await countBottlesInCrate({ db, crateId: crate.id });
          return {
            bottle: await reloadDetail({ context, id: bottleId }),
            crate: { ...presentCrateRef(crate), bottles: occupied, capacity: crate.capacity },
            warning:
              occupied > crate.capacity
                ? `La clayette dépasse sa capacité (${occupied} bouteilles pour ${crate.capacity} places).`
                : null,
          };
        },
      });
    },
  );

  server.registerTool(
    'update_bottle',
    {
      title: 'Modifier une bouteille',
      description:
        "Modifie une bouteille. Seuls les champs fournis changent ; null efface un champ facultatif. user_note et rating sont modifiables par tout membre de la cave, y compris reader ; tout le reste est réservé à owner et editor. Pour une bouteille bue, utiliser consume_bottle plutôt que de baisser quantity : la consommation reste dans l'historique. Pour changer de clayette, utiliser move_bottles. Renvoie la fiche à jour.",
      inputSchema: {
        bottle_id: bottleIdField,
        name: bottleDescriptionFields.name.optional(),
        producer: clearable(bottleDescriptionFields.producer),
        vintage: clearable(bottleDescriptionFields.vintage),
        region: clearable(bottleDescriptionFields.region),
        sub_region: clearable(bottleDescriptionFields.sub_region),
        color: clearable(bottleDescriptionFields.color),
        abv: clearable(bottleDescriptionFields.abv),
        volume_ml: clearable(bottleDescriptionFields.volume_ml),
        appellation: clearable(bottleDescriptionFields.appellation),
        classification: clearable(bottleDescriptionFields.classification),
        grape_varieties: clearable(bottleDescriptionFields.grape_varieties),
        quantity: z.number().int().min(0).max(1000).optional().describe('Quantité en stock.'),
        drink_from: clearable(drinkWindowFields.drink_from),
        drink_until: clearable(drinkWindowFields.drink_until),
        user_note: clearable(userNoteField),
        rating: clearable(ratingField),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ bottle_id: bottleId, ...input }) => {
      return runTool({
        tool: 'update_bottle',
        work: async () => {
          const { bottle, role } = await resolveBottle({ context, id: bottleId });
          const patch = buildBottlePatch({ target: bottle, input });
          const fields = Object.keys(patch);
          if (fields.length === 0) {
            throw new ToolError('Aucun champ à modifier.');
          }
          if (!isPersonalBottlePatch(fields)) {
            requireEditor(role);
          }
          await updateBottle({ db, bottleId, input: patch });
          return reloadDetail({ context, id: bottleId });
        },
      });
    },
  );

  server.registerTool(
    'move_bottles',
    {
      title: 'Déplacer des bouteilles',
      description:
        "Déplace tout ou partie du stock d'une bouteille vers une autre clayette de la même cave. Si la clayette cible contient déjà un lot du même vin (même catégorie, nom, producteur, millésime, couleur et contenance, sans tenir compte des accents ni de la casse), les bouteilles le rejoignent (merged : true) : bottle_id du résultat est alors celui de ce lot, et la fiche d'origine disparaît si tout son stock est parti. Un déplacement partiel sans lot identique crée une copie de la fiche dans la clayette cible. Réservé à owner et editor. Renvoie la fiche du lot qui contient désormais les bouteilles.",
      inputSchema: {
        bottle_id: bottleIdField,
        crate_id: crateIdField.describe(
          'Clayette de destination, dans la même cave (voir get_cellar_overview).',
        ),
        quantity: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe('Nombre de bouteilles à déplacer. Par défaut : tout le stock.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    (input) => {
      return runTool({
        tool: 'move_bottles',
        work: async () => {
          const { bottle, role } = await resolveBottle({ context, id: input.bottle_id });
          requireEditor(role);
          // La clayette cible doit aussi être dans une cave dont le compte est
          // membre ; `moveBottles` vérifie ensuite qu'elle est dans la même.
          await resolveCrate({ context, id: input.crate_id });
          let moved: MoveBottlesResult;
          try {
            moved = await moveBottles({
              db,
              bottleId: bottle.id,
              toCrateId: input.crate_id,
              quantity: input.quantity,
            });
          } catch (error: unknown) {
            if (error instanceof BottleMoveError) {
              throw new ToolError(error.message);
            }
            throw error;
          }
          return {
            moved_quantity: input.quantity ?? bottle.quantity,
            merged: moved.merged,
            bottle: await reloadDetail({ context, id: moved.bottleId }),
          };
        },
      });
    },
  );

  server.registerTool(
    'delete_bottle',
    {
      title: 'Supprimer une bouteille',
      description:
        "Supprime définitivement une bouteille de la cave (fiche, note, analyse). Réservé à owner et editor. Pour une bouteille bue, utiliser consume_bottle à la place. Les consommations passées restent dans l'historique.",
      inputSchema: { bottle_id: bottleIdField },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    ({ bottle_id: bottleId }) => {
      return runTool({
        tool: 'delete_bottle',
        work: async () => {
          const { bottle, role } = await resolveBottle({ context, id: bottleId });
          requireEditor(role);
          await deleteBottle({ db, bottleId: bottle.id });
          return { deleted: true, bottle_id: bottle.id, name: bottle.name };
        },
      });
    },
  );

  server.registerTool(
    'save_bottle_analysis',
    {
      title: 'Enregistrer une analyse de sommelier',
      description:
        "Enregistre sur la fiche d'une bouteille l'analyse que tu as rédigée : profil du vin, accords mets-vin, conseils de service. Elle remplace l'analyse affichée dans l'application (même emplacement que l'analyse IA de l'app). La fenêtre de garde, la région, la sous-région, l'appellation et les cépages proposés ne sont écrits que s'ils sont encore vides : ce qui est déjà renseigné n'est jamais écrasé (update_bottle pour corriger). Réservé à owner et editor. Renvoie la fiche à jour.",
      inputSchema: {
        bottle_id: bottleIdField,
        analysis: z.string().trim().min(1).max(4000).describe('2 à 4 phrases sur le profil du vin.'),
        pairings: z
          .array(z.string().trim().min(1).max(FIELD_MAX.shortText))
          .min(3)
          .max(5)
          .describe('3 à 5 accords mets-vin.'),
        tasting_advice: z
          .string()
          .trim()
          .min(1)
          .max(FIELD_MAX.longText)
          .describe('Conseils de service : température, carafage, verre…'),
        drink_from: drinkWindowFields.drink_from.optional(),
        drink_until: drinkWindowFields.drink_until.optional(),
        region: bottleDescriptionFields.region.optional(),
        sub_region: bottleDescriptionFields.sub_region.optional(),
        appellation: bottleDescriptionFields.appellation.optional(),
        grape_varieties: bottleDescriptionFields.grape_varieties.optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    (input) => {
      return runTool({
        tool: 'save_bottle_analysis',
        work: async () => {
          const { bottle, role } = await resolveBottle({ context, id: input.bottle_id });
          requireEditor(role);
          checkDrinkWindow({ drinkFrom: input.drink_from, drinkUntil: input.drink_until });
          const analysis = aiBottleAnalysisSchema.parse({
            analysis: input.analysis,
            pairings: input.pairings,
            tastingAdvice: input.tasting_advice,
            drinkFromYear: input.drink_from ?? null,
            drinkUntilYear: input.drink_until ?? null,
            region: input.region ?? null,
            subRegion: input.sub_region ?? null,
            grapeVarieties: input.grape_varieties ?? null,
            appellation: input.appellation ?? null,
          });
          await saveBottleAiAnalysis({ db, bottle, analysis });
          return reloadDetail({ context, id: bottle.id });
        },
      });
    },
  );
};
