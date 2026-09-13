import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createUserAccount } from './accounts';
import {
  createWishlistItem,
  listWishlistItems,
  getWishlistItem,
  resolveWishlistItemAccess,
  updateWishlistItem,
  updateWishlistItemBodySchema,
  deleteWishlistItem,
  createWishlistItemBodySchema,
} from './wishlist';
import { createCrate } from './crates';
import { saveWishlistAiAnalysis } from './ai/wishlistAnalysis';
import { getBottle } from './bottles';
import {
  promoteWishlistItem,
  promoteWishlistItemBodySchema,
  listPromotionTargets,
} from './wishlist';

describe('createWishlistItem / getWishlistItem', () => {
  it('creates item with valid details for category', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });

    const id = await createWishlistItem(db, {
      userId,
      category: 'wine',
      name: 'Clos Poggiale',
      details: { grapeVarieties: ['Niellucciu', 'Syrah'], appellation: 'Patrimonio' },
    });

    const item = await getWishlistItem(db, id);
    expect(item?.name).toBe('Clos Poggiale');
    expect(item?.userId).toBe(userId);
    expect(item?.status).toBe('pending');
    expect(item?.promotedBottleId).toBeNull();
    expect(item?.details).toEqual({ grapeVarieties: ['Niellucciu', 'Syrah'], appellation: 'Patrimonio' });
  });

  it('rejects invalid details for category', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });

    await expect(
      createWishlistItem(db, { userId, category: 'cider', name: 'Cidre', details: { method: 'industriel' } }),
    ).rejects.toThrow();
  });
});

describe('createWishlistItemBodySchema', () => {
  it('rejette une catégorie hors énumération', () => {
    expect(
      createWishlistItemBodySchema.safeParse({ category: 'digestif', name: 'X', details: {} }).success,
    ).toBe(false);
  });

  it('accepte un corps minimal valide', () => {
    expect(
      createWishlistItemBodySchema.safeParse({ category: 'wine', name: 'Clos Poggiale', details: {} }).success,
    ).toBe(true);
  });

  it('rejette un nom vide', () => {
    expect(createWishlistItemBodySchema.safeParse({ category: 'wine', name: '', details: {} }).success).toBe(false);
  });
});

describe('listWishlistItems', () => {
  it('returns only items for requested user, newest first', async () => {
    const db = await createTestDb();
    const { userId: userA } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave A' });
    const userB = await createUserAccount(db, 'b@example.com', 'password123');

    await createWishlistItem(db, { userId: userA, category: 'wine', name: 'Premier', details: {} });
    await createWishlistItem(db, { userId: userA, category: 'wine', name: 'Second', details: {} });
    await createWishlistItem(db, { userId: userB, category: 'wine', name: 'Not mine', details: {} });

    const items = await listWishlistItems(db, userA);
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe('Second');
    expect(items[1].name).toBe('Premier');
  });
});

describe('resolveWishlistItemAccess', () => {
  it('returns ok for owner', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const id = await createWishlistItem(db, { userId, category: 'wine', name: 'Wine', details: {} });

    const access = await resolveWishlistItemAccess(db, userId, id);
    expect(access.status).toBe('ok');
  });

  it('returns not_found for unknown id', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const access = await resolveWishlistItemAccess(db, userId, 'unknown');
    expect(access.status).toBe('not_found');
  });

  it('returns forbidden for different user, even if super-admin', async () => {
    const db = await createTestDb();
    const { userId: owner } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const id = await createWishlistItem(db, { userId: owner, category: 'wine', name: 'Wine', details: {} });

    // Use bootstrapSuperAdmin to create a second super-admin account
    // This proves there is no super-admin bypass, not just that
    // regular users fail for a different reason.
    const { userId: otherSuperAdmin } = await bootstrapSuperAdmin(db, { email: 'admin2@example.com', password: 'x', cellarName: 'Another cellar' });
    const access = await resolveWishlistItemAccess(db, otherSuperAdmin, id);
    expect(access.status).toBe('forbidden');
  });
});

describe('updateWishlistItem', () => {
  it('updates identity fields and details', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const id = await createWishlistItem(db, { userId, category: 'wine', name: 'Wine', details: {} });

    await updateWishlistItem(db, id, {
      name: 'Clos Poggiale',
      producer: 'Domaine Poggiale',
      vintage: 2023,
      details: { grapeVarieties: ['Niellucciu'], appellation: 'Patrimonio' },
    });

    const item = await getWishlistItem(db, id);
    expect(item?.name).toBe('Clos Poggiale');
    expect(item?.producer).toBe('Domaine Poggiale');
    expect(item?.vintage).toBe(2023);
    expect(item?.details).toEqual({ grapeVarieties: ['Niellucciu'], appellation: 'Patrimonio' });
  });
});

describe('updateWishlistItemBodySchema', () => {
  it('rejects unknown key', () => {
    expect(updateWishlistItemBodySchema.safeParse({ notAField: 'x' }).success).toBe(false);
  });

  it('accepts partial update', () => {
    expect(updateWishlistItemBodySchema.safeParse({ name: 'New name' }).success).toBe(true);
  });

  it('rejects category (immutable)', () => {
    expect(updateWishlistItemBodySchema.safeParse({ category: 'beer' }).success).toBe(false);
  });
});

describe('deleteWishlistItem', () => {
  it('deletes an item', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const id = await createWishlistItem(db, { userId, category: 'wine', name: 'Wine', details: {} });

    await deleteWishlistItem(db, id);
    expect(await getWishlistItem(db, id)).toBeNull();
  });
});

describe('promoteWishlistItemBodySchema', () => {
  it('rejette une quantité nulle', () => {
    expect(promoteWishlistItemBodySchema.safeParse({ crateId: 'x', quantity: 0 }).success).toBe(false);
  });

  it('accepte crateId et quantity valides', () => {
    expect(promoteWishlistItemBodySchema.safeParse({ crateId: 'x', quantity: 2 }).success).toBe(true);
  });
});

describe('promoteWishlistItem', () => {
  it("crée une vraie bouteille et marque l'item promu", async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const itemId = await createWishlistItem(db, {
      userId,
      category: 'wine',
      name: 'Clos Poggiale',
      producer: 'Domaine Poggiale',
      vintage: 2023,
      region: 'Corse',
      color: 'rouge',
      details: { grapeVarieties: ['Niellucciu', 'Syrah'], appellation: 'Patrimonio' },
    });
    const item = await getWishlistItem(db, itemId);

    const { bottleId } = await promoteWishlistItem(db, item!, { crateId, quantity: 3 });

    const bottle = await getBottle(db, bottleId);
    expect(bottle?.name).toBe('Clos Poggiale');
    expect(bottle?.producer).toBe('Domaine Poggiale');
    expect(bottle?.vintage).toBe(2023);
    expect(bottle?.color).toBe('rouge');
    expect(bottle?.quantity).toBe(3);
    expect(bottle?.crateId).toBe(crateId);
    expect(bottle?.details).toEqual({ grapeVarieties: ['Niellucciu', 'Syrah'], appellation: 'Patrimonio' });

    const promotedItem = await getWishlistItem(db, itemId);
    expect(promotedItem?.status).toBe('promoted');
    expect(promotedItem?.promotedBottleId).toBe(bottleId);
  });

  it('refuse de promouvoir un item déjà promu', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const itemId = await createWishlistItem(db, { userId, category: 'wine', name: 'Vin', details: {} });
    const item = await getWishlistItem(db, itemId);
    await promoteWishlistItem(db, item!, { crateId, quantity: 1 });

    const promotedItem = await getWishlistItem(db, itemId);
    await expect(promoteWishlistItem(db, promotedItem!, { crateId, quantity: 1 })).rejects.toThrow();
  });
});

describe('listPromotionTargets', () => {
  it("liste les caves où l'utilisateur peut éditer, avec leurs clayettes", async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave A' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });

    const targets = await listPromotionTargets(db, userId);

    expect(targets).toHaveLength(1);
    expect(targets[0].cellarId).toBe(cellarId);
    expect(targets[0].cellarName).toBe('Cave A');
    expect(targets[0].crates.map((c) => c.id)).toEqual([crateId]);
  });

  it("exclut les caves où l'utilisateur n'a qu'un rôle lecteur", async () => {
    const db = await createTestDb();
    const owner = await bootstrapSuperAdmin(db, { email: 'owner@example.com', password: 'x', cellarName: 'Cave' });
    const readerId = await createUserAccount(db, 'reader@example.com', 'password123');
    // owner ajoute readerId comme lecteur — insertion directe pour ce test,
    // la logique d'invitation n'est pas testée ici.
    const { cellarMemberships } = await import('../db/schema');
    await db.insert(cellarMemberships).values({
      id: 'membership-test',
      cellarId: owner.cellarId,
      userId: readerId,
      role: 'reader',
      createdAt: new Date().toISOString(),
    });

    const targets = await listPromotionTargets(db, readerId);
    expect(targets).toHaveLength(0);
  });
});

describe('commentaire d’un item de wishlist', () => {
  it('enregistre le commentaire saisi à l’ajout', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });

    const id = await createWishlistItem(db, {
      userId,
      category: 'wine',
      name: 'Clos Poggiale',
      details: { grapeVarieties: [] },
      comment: 'Conseillée par Paul, vue à 25 € chez le caviste',
    });

    expect((await getWishlistItem(db, id))?.comment).toBe('Conseillée par Paul, vue à 25 € chez le caviste');
  });

  it('laisse le commentaire à null quand il est absent', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });

    const id = await createWishlistItem(db, {
      userId,
      category: 'beer',
      name: 'Triple Karmeliet',
      details: {},
    });

    expect((await getWishlistItem(db, id))?.comment).toBeNull();
  });

  it('traite un commentaire vide ou blanc comme une absence', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });

    const id = await createWishlistItem(db, {
      userId,
      category: 'beer',
      name: 'Triple Karmeliet',
      details: {},
      comment: '   ',
    });

    expect((await getWishlistItem(db, id))?.comment).toBeNull();
  });

  it('permet de modifier puis d’effacer le commentaire', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const id = await createWishlistItem(db, {
      userId,
      category: 'wine',
      name: 'Clos Poggiale',
      details: { grapeVarieties: [] },
      comment: 'Première note',
    });

    await updateWishlistItem(db, id, { comment: 'Note corrigée' });
    expect((await getWishlistItem(db, id))?.comment).toBe('Note corrigée');

    await updateWishlistItem(db, id, { comment: null });
    expect((await getWishlistItem(db, id))?.comment).toBeNull();
  });

  it('accepte le commentaire dans les deux schémas de corps de requête', () => {
    const created = createWishlistItemBodySchema.safeParse({
      category: 'wine',
      name: 'Clos Poggiale',
      details: { grapeVarieties: [] },
      comment: 'Conseillée par Paul',
    });
    expect(created.success).toBe(true);

    expect(updateWishlistItemBodySchema.safeParse({ comment: 'Note corrigée' }).success).toBe(true);
    // `null` explicite : c'est ce que le formulaire d'édition envoie pour
    // effacer le commentaire.
    expect(updateWishlistItemBodySchema.safeParse({ comment: null }).success).toBe(true);
  });

  it('refuse un commentaire déraisonnablement long', () => {
    const tooLong = 'x'.repeat(2001);
    expect(
      createWishlistItemBodySchema.safeParse({
        category: 'beer',
        name: 'Triple Karmeliet',
        details: {},
        comment: tooLong,
      }).success,
    ).toBe(false);
    expect(updateWishlistItemBodySchema.safeParse({ comment: tooLong }).success).toBe(false);
  });
});

describe('promotion et commentaire', () => {
  it('reverse le commentaire de l’item dans la note de la bouteille', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, {
      email: 'a@example.com',
      password: 'x',
      cellarName: 'Cave',
    });
    const crateId = await createCrate(db, { cellarId, capacity: 12 });
    const itemId = await createWishlistItem(db, {
      userId,
      category: 'wine',
      name: 'Clos Poggiale',
      details: { grapeVarieties: [] },
      comment: 'Conseillée par Paul',
    });
    const item = await getWishlistItem(db, itemId);

    const { bottleId } = await promoteWishlistItem(db, item!, { crateId, quantity: 2 });

    expect((await getBottle(db, bottleId))?.userNote).toBe('Conseillée par Paul');
    // L'item garde le sien : la wishlist reste lisible telle qu'elle était.
    expect((await getWishlistItem(db, itemId))?.comment).toBe('Conseillée par Paul');
  });

  it('laisse la note à null quand l’item n’a pas de commentaire', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, {
      email: 'a@example.com',
      password: 'x',
      cellarName: 'Cave',
    });
    const crateId = await createCrate(db, { cellarId, capacity: 12 });
    const itemId = await createWishlistItem(db, {
      userId,
      category: 'beer',
      name: 'Triple Karmeliet',
      details: {},
    });
    const item = await getWishlistItem(db, itemId);

    const { bottleId } = await promoteWishlistItem(db, item!, { crateId, quantity: 1 });

    expect((await getBottle(db, bottleId))?.userNote).toBeNull();
  });
});

describe('promotion et analyse IA', () => {
  it('reverse l’analyse et la fenêtre de garde dans la bouteille', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, {
      email: 'a@example.com',
      password: 'x',
      cellarName: 'Cave',
    });
    const crateId = await createCrate(db, { cellarId, capacity: 12 });
    const itemId = await createWishlistItem(db, {
      userId,
      category: 'wine',
      name: 'Clos Poggiale',
      details: { grapeVarieties: [] },
    });
    await saveWishlistAiAnalysis(
      db,
      { id: itemId, category: 'wine', drinkFrom: null, drinkUntil: null, region: null, details: { grapeVarieties: [] } },
      {
        analysis: 'Un rouge corsé.',
        pairings: ['Agneau', 'Daube', 'Fromages'],
        tastingAdvice: 'Carafer une heure.',
        drinkFromYear: 2027,
        drinkUntilYear: 2034,
        region: 'Patrimonio',
        grapeVarieties: ['Niellucciu'],
        appellation: 'Patrimonio',
      },
    );
    const item = await getWishlistItem(db, itemId);

    const { bottleId } = await promoteWishlistItem(db, item!, { crateId, quantity: 1 });

    const bottle = await getBottle(db, bottleId);
    expect(bottle?.aiAnalysis).toBe('Un rouge corsé.');
    expect(bottle?.aiPairings).toEqual(['Agneau', 'Daube', 'Fromages']);
    expect(bottle?.aiTastingAdvice).toBe('Carafer une heure.');
    expect(bottle?.aiGeneratedAt).toBe(item!.aiGeneratedAt);
    expect(bottle?.drinkFrom).toBe(2027);
    expect(bottle?.drinkUntil).toBe(2034);
  });

  it('laisse les champs ai* à null quand l’item n’a pas été analysé', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, {
      email: 'a@example.com',
      password: 'x',
      cellarName: 'Cave',
    });
    const crateId = await createCrate(db, { cellarId, capacity: 12 });
    const itemId = await createWishlistItem(db, {
      userId,
      category: 'beer',
      name: 'Triple Karmeliet',
      details: {},
    });
    const item = await getWishlistItem(db, itemId);

    const { bottleId } = await promoteWishlistItem(db, item!, { crateId, quantity: 1 });

    const bottle = await getBottle(db, bottleId);
    expect(bottle?.aiAnalysis).toBeNull();
    expect(bottle?.aiGeneratedAt).toBeNull();
    expect(bottle?.drinkFrom).toBeNull();
  });
});
