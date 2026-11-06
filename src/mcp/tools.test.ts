import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createTestDb } from '@/db/testDb';
import type { Db } from '@/db/client';
import { eq } from 'drizzle-orm';
import { cellarMemberships, users } from '@/db/schema';
import { newId } from '@/db/id';
import { createCrate } from '@/domain/crates';
import { parisDay } from '@/domain/parisDate';
import { callTool, callToolJson, connectTestClient, createTestMember } from './mcpTestSupport';
import type { TestMember } from './interfaces/test-member.interface';

const addedSchema = z.object({ bottle: z.object({ bottle_id: z.string() }) });
const idOf = (value: unknown): string => addedSchema.parse(value).bottle.bottle_id;

interface World {
  db: Db;
  owner: TestMember;
  client: Client;
  crateId: string;
}

const setup = async (): Promise<World> => {
  const db = await createTestDb();
  const owner = await createTestMember(db, 'hugo@example.com');
  const crateId = await createCrate({ db, input: { cellarId: owner.cellarId, name: 'Rouges', capacity: 6 } });
  const client = await connectTestClient({ db, user: owner.user });
  return { db, owner, client, crateId };
};

/** Membre d'une cave existante, avec le rôle donné. */
const joinAs = async (
  world: World,
  email: string,
  role: 'editor' | 'reader',
): Promise<{ member: TestMember; client: Client }> => {
  const member = await createTestMember(world.db, email);
  await world.db.insert(cellarMemberships).values({
    id: newId(),
    cellarId: world.owner.cellarId,
    userId: member.user.id,
    role,
    // Rejointe après sa propre cave : celle-ci reste sa cave par défaut.
    createdAt: new Date(Date.now() + 1000).toISOString(),
  });
  return { member, client: await connectTestClient({ db: world.db, user: member.user }) };
};

const addLandonne = async (
  { client, crateId }: World,
  extra: Record<string, unknown> = {},
): Promise<string> => {
  return idOf(
    await callToolJson({
      client,
      name: 'add_bottle',
      args: {
        crate_id: crateId,
        category: 'wine',
        name: 'Côte-Rôtie La Landonne',
        producer: 'Guigal',
        vintage: 2015,
        color: 'rouge',
        appellation: 'Côte-Rôtie',
        grape_varieties: ['Syrah'],
        quantity: 3,
        ...extra,
      },
    }),
  );
};

describe('serveur MCP Ma Cave', () => {
  let world: World;

  beforeEach(async () => {
    world = await setup();
  });

  it('expose les tools attendus, annotés lecture ou écriture', async () => {
    const { tools } = await world.client.listTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    expect([...byName.keys()].sort()).toEqual([
      'add_bottle',
      'add_wishlist_item',
      'consume_bottle',
      'delete_bottle',
      'delete_consumption',
      'delete_wishlist_item',
      'get_bottle',
      'get_cellar_overview',
      'list_cellars',
      'list_consumptions',
      'list_wishlist',
      'move_bottles',
      'promote_wishlist_item',
      'save_bottle_analysis',
      'search_bottles',
      'update_bottle',
      'update_consumption',
      'update_wishlist_item',
    ]);
    expect(byName.get('search_bottles')?.annotations?.readOnlyHint).toBe(true);
    expect(byName.get('delete_bottle')?.annotations?.destructiveHint).toBe(true);
  });

  describe('caves', () => {
    it('liste les caves du compte avec son rôle et son stock', async () => {
      await addLandonne(world);

      expect(await callToolJson({ client: world.client, name: 'list_cellars' })).toEqual({
        cellars: [
          {
            cellar_id: world.owner.cellarId,
            name: 'Cave de hugo@example.com',
            role: 'owner',
            is_default: true,
            bottles: 3,
            references: 1,
          },
        ],
      });
    });

    it("résume la cave et l'occupation de ses clayettes", async () => {
      await addLandonne(world);

      const overview = await callToolJson({ client: world.client, name: 'get_cellar_overview' });

      expect(overview).toMatchObject({
        cellar_id: world.owner.cellarId,
        bottles: 3,
        capacity: 6,
        by_color: { rouge: 3 },
        // Région déduite de l'appellation (voir resolveWineGeography).
        top_regions: [{ region: 'Rhône', bottles: 3 }],
        crates: [{ crate_id: world.crateId, label: 'Clayette 1 — Rouges', capacity: 6, bottles: 3 }],
      });
    });

    it("refuse une cave d'un autre compte", async () => {
      const stranger = await createTestMember(world.db, 'autre@example.com');

      const result = await callTool({
        client: world.client,
        name: 'get_cellar_overview',
        args: { cellar_id: stranger.cellarId },
      });

      expect(result).toEqual({ isError: true, text: expect.stringContaining('introuvable') as unknown });
    });
  });

  describe('bouteilles', () => {
    it('ajoute une bouteille, la retrouve sans accents et donne sa fiche', async () => {
      const bottleId = await addLandonne(world);

      const found = await callToolJson({
        client: world.client,
        name: 'search_bottles',
        args: { query: 'cote rotie' },
      });
      const detail = await callToolJson({
        client: world.client,
        name: 'get_bottle',
        args: { bottle_id: bottleId },
      });

      expect(found).toMatchObject({ total: 1, bottles: [{ bottle_id: bottleId, quantity: 3 }] });
      expect(detail).toMatchObject({
        bottle_id: bottleId,
        region: 'Rhône',
        appellation: 'Côte-Rôtie',
        grape_varieties: ['Syrah'],
        role: 'owner',
        consumptions: [],
      });
    });

    it('signale une clayette pleine sans bloquer', async () => {
      const added = await callToolJson({
        client: world.client,
        name: 'add_bottle',
        args: { crate_id: world.crateId, category: 'wine', name: 'Caisse', quantity: 8 },
      });

      expect(added).toMatchObject({
        crate: { bottles: 8, capacity: 6 },
        warning: expect.stringContaining('capacité') as unknown,
      });
    });

    it('refuse les champs qui ne concernent pas la catégorie', async () => {
      const color = await callTool({
        client: world.client,
        name: 'add_bottle',
        args: { crate_id: world.crateId, category: 'beer', name: 'IPA', color: 'blanc' },
      });
      const appellation = await callTool({
        client: world.client,
        name: 'add_bottle',
        args: {
          crate_id: world.crateId,
          category: 'sparkling',
          name: 'Crémant',
          appellation: 'Crémant de Loire',
        },
      });

      expect(color.isError).toBe(true);
      expect(appellation.isError).toBe(true);
    });

    it('pagine les résultats', async () => {
      for (const name of ['A', 'B', 'C']) {
        await callToolJson({
          client: world.client,
          name: 'add_bottle',
          args: { crate_id: world.crateId, category: 'wine', name },
        });
      }

      const first = await callToolJson({ client: world.client, name: 'search_bottles', args: { limit: 2 } });
      const second = await callToolJson({
        client: world.client,
        name: 'search_bottles',
        args: { limit: 2, offset: 2 },
      });

      expect(first).toMatchObject({ total: 3, next_offset: 2 });
      expect(second).toMatchObject({ total: 3, bottles: [{ name: 'C' }] });
      expect(second).not.toHaveProperty('next_offset');
    });

    it('modifie seulement les champs fournis, efface sur null, et recale la géographie', async () => {
      const bottleId = await addLandonne(world);

      const updated = await callToolJson({
        client: world.client,
        name: 'update_bottle',
        args: {
          bottle_id: bottleId,
          producer: null,
          appellation: 'Saint-Julien',
          drink_from: 2025,
          drink_until: 2040,
        },
      });

      expect(updated).toMatchObject({
        name: 'Côte-Rôtie La Landonne',
        region: 'Bordeaux',
        appellation: 'Saint-Julien',
        grape_varieties: ['Syrah'],
        drink_from: 2025,
        drink_until: 2040,
      });
      expect(updated).not.toHaveProperty('producer');
    });

    it('refuse une fenêtre de garde inversée', async () => {
      const bottleId = await addLandonne(world, { drink_from: 2030 });

      const result = await callTool({
        client: world.client,
        name: 'update_bottle',
        args: { bottle_id: bottleId, drink_until: 2020 },
      });

      expect(result.isError).toBe(true);
    });

    it('déplace une partie du stock : une copie de la fiche rejoint la clayette cible', async () => {
      const bottleId = await addLandonne(world);
      const otherCrate = await createCrate({
        db: world.db,
        input: { cellarId: world.owner.cellarId, capacity: 6 },
      });

      const moved = await callToolJson({
        client: world.client,
        name: 'move_bottles',
        args: { bottle_id: bottleId, crate_id: otherCrate, quantity: 1 },
      });
      const source = await callToolJson({
        client: world.client,
        name: 'get_bottle',
        args: { bottle_id: bottleId },
      });

      expect(moved).toMatchObject({
        moved_quantity: 1,
        merged: false,
        bottle: { quantity: 1, crate: { crate_id: otherCrate } },
      });
      expect(idOf(moved)).not.toBe(bottleId);
      expect(source).toMatchObject({ quantity: 2, crate: { crate_id: world.crateId } });
    });

    it('fusionne avec le lot du même vin déjà présent dans la clayette cible', async () => {
      const bottleId = await addLandonne(world);
      const otherCrate = await createCrate({
        db: world.db,
        input: { cellarId: world.owner.cellarId, capacity: 6 },
      });
      const lotId = idOf(
        await callToolJson({
          client: world.client,
          name: 'add_bottle',
          args: {
            crate_id: otherCrate,
            category: 'wine',
            name: 'Côte-Rôtie La Landonne',
            producer: 'Guigal',
            vintage: 2015,
            color: 'rouge',
          },
        }),
      );

      const moved = await callToolJson({
        client: world.client,
        name: 'move_bottles',
        args: { bottle_id: bottleId, crate_id: otherCrate },
      });
      const gone = await callTool({
        client: world.client,
        name: 'get_bottle',
        args: { bottle_id: bottleId },
      });

      expect(moved).toMatchObject({
        moved_quantity: 3,
        merged: true,
        bottle: { bottle_id: lotId, quantity: 4 },
      });
      expect(gone.isError).toBe(true);
    });

    it("refuse de déplacer une bouteille vers la clayette d'une autre cave", async () => {
      const bottleId = await addLandonne(world);
      const stranger = await createTestMember(world.db, 'autre@example.com');
      const foreignCrate = await createCrate({
        db: world.db,
        input: { cellarId: stranger.cellarId, capacity: 6 },
      });
      const ownCellar = await createTestMember(world.db, 'second@example.com');
      // Membre des deux caves : le refus vient bien de la règle « même cave ».
      await world.db.insert(cellarMemberships).values({
        id: newId(),
        cellarId: ownCellar.cellarId,
        userId: world.owner.user.id,
        role: 'owner',
        createdAt: new Date(Date.now() + 1000).toISOString(),
      });
      const secondCrate = await createCrate({
        db: world.db,
        input: { cellarId: ownCellar.cellarId, capacity: 6 },
      });

      const foreign = await callTool({
        client: world.client,
        name: 'move_bottles',
        args: { bottle_id: bottleId, crate_id: foreignCrate },
      });
      const otherCellar = await callTool({
        client: world.client,
        name: 'move_bottles',
        args: { bottle_id: bottleId, crate_id: secondCrate },
      });

      expect(foreign.isError).toBe(true);
      expect(otherCellar).toEqual({
        isError: true,
        text: 'La clayette de destination doit appartenir à la même cave.',
      });
    });

    it("ne montre pas la bouteille d'une cave dont on n'est pas membre", async () => {
      const bottleId = await addLandonne(world);
      const stranger = await createTestMember(world.db, 'autre@example.com');
      const strangerClient = await connectTestClient({ db: world.db, user: stranger.user });

      const result = await callTool({
        client: strangerClient,
        name: 'get_bottle',
        args: { bottle_id: bottleId },
      });

      expect(result).toEqual({ isError: true, text: 'Bouteille introuvable ou inaccessible.' });
    });

    it('supprime une bouteille', async () => {
      const bottleId = await addLandonne(world);

      await callToolJson({ client: world.client, name: 'delete_bottle', args: { bottle_id: bottleId } });

      expect(await callToolJson({ client: world.client, name: 'search_bottles' })).toMatchObject({
        total: 0,
      });
    });

    it("enregistre l'analyse sans écraser la fenêtre de garde déjà saisie", async () => {
      const bottleId = await addLandonne(world, { drink_from: 2024, drink_until: 2045 });

      const detail = await callToolJson({
        client: world.client,
        name: 'save_bottle_analysis',
        args: {
          bottle_id: bottleId,
          analysis: 'Syrah dense et fumée.',
          pairings: ['Gigot', 'Côte de bœuf', 'Comté affiné'],
          tasting_advice: 'Carafer une heure, servir à 17 °C.',
          drink_from: 2030,
          drink_until: 2050,
        },
      });

      expect(detail).toMatchObject({
        analysis: 'Syrah dense et fumée.',
        pairings: ['Gigot', 'Côte de bœuf', 'Comté affiné'],
        drink_from: 2024,
        drink_until: 2045,
      });
    });
  });

  describe('droits par rôle', () => {
    it('laisse un lecteur consommer et noter, mais pas modifier le contenu', async () => {
      const bottleId = await addLandonne(world);
      const { client: reader } = await joinAs(world, 'lecteur@example.com', 'reader');

      const rating = await callTool({
        client: reader,
        name: 'update_bottle',
        args: { bottle_id: bottleId, rating: 5, user_note: 'Superbe' },
      });
      const rename = await callTool({
        client: reader,
        name: 'update_bottle',
        args: { bottle_id: bottleId, rating: 4, name: 'Autre' },
      });
      const consume = await callTool({
        client: reader,
        name: 'consume_bottle',
        args: { bottle_id: bottleId },
      });
      const add = await callTool({
        client: reader,
        name: 'add_bottle',
        args: { crate_id: world.crateId, category: 'wine', name: 'X' },
      });

      const move = await callTool({
        client: reader,
        name: 'move_bottles',
        args: { bottle_id: bottleId, crate_id: world.crateId },
      });

      expect(rating.isError).toBe(false);
      expect(move).toMatchObject({
        isError: true,
        text: expect.stringContaining('Rôle insuffisant') as unknown,
      });
      expect(rename).toMatchObject({
        isError: true,
        text: expect.stringContaining('Rôle insuffisant') as unknown,
      });
      expect(consume.isError).toBe(false);
      expect(add.isError).toBe(true);
    });

    it('laisse un éditeur ajouter une bouteille', async () => {
      const { client: editor } = await joinAs(world, 'editeur@example.com', 'editor');

      const result = await callTool({
        client: editor,
        name: 'add_bottle',
        args: { crate_id: world.crateId, category: 'wine', name: 'X' },
      });

      expect(result.isError).toBe(false);
    });
  });

  describe('accès du super-admin', () => {
    it("n'ouvre que les caves dont le compte est membre", async () => {
      const bottleId = await addLandonne(world);
      const admin = await createTestMember(world.db, 'admin@example.com');
      await world.db.update(users).set({ isSuperAdmin: true }).where(eq(users.id, admin.user.id));
      const adminClient = await connectTestClient({
        db: world.db,
        user: { ...admin.user, isSuperAdmin: true },
      });
      const call = (name: string, args: Record<string, unknown>): ReturnType<typeof callTool> => {
        return callTool({ client: adminClient, name, args });
      };

      // Dans l'app, ce compte verrait la cave d'Hugo ; par MCP, non.
      expect((await call('get_cellar_overview', { cellar_id: world.owner.cellarId })).isError).toBe(true);
      expect((await call('search_bottles', { cellar_id: world.owner.cellarId })).isError).toBe(true);
      expect((await call('get_bottle', { bottle_id: bottleId })).isError).toBe(true);
      expect((await call('consume_bottle', { bottle_id: bottleId })).isError).toBe(true);
      expect(
        (await call('add_bottle', { crate_id: world.crateId, category: 'wine', name: 'X' })).isError,
      ).toBe(true);
      expect(await callToolJson({ client: adminClient, name: 'list_cellars' })).toMatchObject({
        cellars: [{ cellar_id: admin.cellarId, role: 'owner' }],
      });
      expect(await callToolJson({ client: adminClient, name: 'get_cellar_overview' })).toMatchObject({
        cellar_id: admin.cellarId,
      });
    });
  });

  describe('consommations', () => {
    it("décrémente le stock, date du jour à Paris, et l'historique la retrouve", async () => {
      const bottleId = await addLandonne(world);

      const consumed = await callToolJson({
        client: world.client,
        name: 'consume_bottle',
        args: { bottle_id: bottleId, quantity: 2, rating: 5, comment: 'Fumé, poivré', occasion: 'Noël' },
      });
      const history = await callToolJson({ client: world.client, name: 'list_consumptions' });
      const detail = await callToolJson({
        client: world.client,
        name: 'get_bottle',
        args: { bottle_id: bottleId },
      });

      expect(consumed).toMatchObject({ consumed_at: parisDay(), bottle: { remaining_quantity: 1 } });
      expect(history).toMatchObject({
        total: 1,
        bottles_consumed: 2,
        entries: [
          { bottle_id: bottleId, comment: 'Fumé, poivré', by_me: true, name: 'Côte-Rôtie La Landonne' },
        ],
      });
      expect(detail).toMatchObject({ quantity: 1, consumptions: [{ rating: 5, occasion: 'Noël' }] });
    });

    it('refuse de consommer plus que le stock', async () => {
      const bottleId = await addLandonne(world);

      const result = await callTool({
        client: world.client,
        name: 'consume_bottle',
        args: { bottle_id: bottleId, quantity: 4 },
      });

      expect(result).toEqual({
        isError: true,
        text: 'Stock insuffisant : il reste 3 bouteille(s) de « Côte-Rôtie La Landonne ».',
      });
    });

    it('refuse une date qui n’existe pas', async () => {
      const bottleId = await addLandonne(world);

      const result = await callTool({
        client: world.client,
        name: 'consume_bottle',
        args: { bottle_id: bottleId, consumed_at: '2026-02-31' },
      });

      expect(result.isError).toBe(true);
    });

    it("filtre l'historique par période, corrige puis supprime une entrée", async () => {
      const bottleId = await addLandonne(world);
      for (const day of ['2026-01-15', '2026-03-02']) {
        await callToolJson({
          client: world.client,
          name: 'consume_bottle',
          args: { bottle_id: bottleId, consumed_at: day },
        });
      }

      const march = await callToolJson({
        client: world.client,
        name: 'list_consumptions',
        args: { from: '2026-03-01', to: '2026-03-31' },
      });
      const entryId = z.object({ entries: z.array(z.object({ entry_id: z.string() })) }).parse(march)
        .entries[0]?.entry_id;
      const corrected = await callToolJson({
        client: world.client,
        name: 'update_consumption',
        args: { entry_id: entryId, comment: 'Encore jeune', consumed_at: '2026-03-03' },
      });
      await callToolJson({ client: world.client, name: 'delete_consumption', args: { entry_id: entryId } });

      expect(march).toMatchObject({ total: 1, entries: [{ consumed_at: '2026-03-02' }] });
      expect(corrected).toMatchObject({ comment: 'Encore jeune', consumed_at: '2026-03-03' });
      expect(await callToolJson({ client: world.client, name: 'list_consumptions' })).toMatchObject({
        total: 1,
      });
    });
  });

  describe('wishlist', () => {
    it('ajoute, modifie, range en cave, et reste privée', async () => {
      const item = await callToolJson({
        client: world.client,
        name: 'add_wishlist_item',
        args: { category: 'sparkling', name: 'Krug Grande Cuvée', comment: 'Pour les 40 ans' },
      });
      const itemId = z.object({ item_id: z.string() }).parse(item).item_id;
      await callToolJson({
        client: world.client,
        name: 'update_wishlist_item',
        args: { item_id: itemId, grape_varieties: ['Chardonnay', 'Pinot Noir'] },
      });

      const promoted = await callToolJson({
        client: world.client,
        name: 'promote_wishlist_item',
        args: { item_id: itemId, crate_id: world.crateId, quantity: 2 },
      });
      const stranger = await createTestMember(world.db, 'autre@example.com');
      const strangerClient = await connectTestClient({ db: world.db, user: stranger.user });

      expect(promoted).toMatchObject({
        bottle: {
          name: 'Krug Grande Cuvée',
          quantity: 2,
          user_note: 'Pour les 40 ans',
          grape_varieties: ['Chardonnay', 'Pinot Noir'],
        },
      });
      expect(await callToolJson({ client: world.client, name: 'list_wishlist' })).toEqual({
        total: 0,
        items: [],
      });
      expect(
        await callToolJson({ client: world.client, name: 'list_wishlist', args: { status: 'promoted' } }),
      ).toMatchObject({ total: 1 });
      expect(
        (await callTool({ client: strangerClient, name: 'delete_wishlist_item', args: { item_id: itemId } }))
          .isError,
      ).toBe(true);
      expect(
        (
          await callTool({
            client: world.client,
            name: 'promote_wishlist_item',
            args: { item_id: itemId, crate_id: world.crateId },
          })
        ).isError,
      ).toBe(true);
    });
  });
});
