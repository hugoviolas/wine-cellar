import { describe, it, expect } from 'vitest';
import { createBottleBodySchema, updateBottleBodySchema } from './bottles';
import { createCrateBodySchema } from './crates';
import { createInvitationBodySchema } from './invitations';
import { consumeBottleBodySchema } from './consume';
import { updateHistoryEntryBodySchema } from './history';
import { createWishlistItemBodySchema } from './wishlist';
import { wineDetailsSchema } from './bottleCategories';
import { FIELD_MAX } from './fieldLimits';

const tooLong = (max: number): string => 'a'.repeat(max + 1);
const atMax = (max: number): string => 'a'.repeat(max);

describe('bornes des champs libres', () => {
  it('refuse un nom de bouteille démesuré, accepte la borne exacte', () => {
    const base = { crateId: 'c1', category: 'wine' as const, quantity: 1, details: {} };
    expect(createBottleBodySchema.safeParse({ ...base, name: tooLong(FIELD_MAX.shortText) }).success).toBe(
      false,
    );
    expect(createBottleBodySchema.safeParse({ ...base, name: atMax(FIELD_MAX.shortText) }).success).toBe(
      true,
    );
  });

  it('borne les autres champs courts d’une bouteille', () => {
    for (const field of ['producer', 'region', 'color'] as const) {
      const body = { crateId: 'c1', category: 'wine', quantity: 1, details: {}, name: 'Vin' };
      expect(
        createBottleBodySchema.safeParse({ ...body, [field]: tooLong(FIELD_MAX.shortText) }).success,
      ).toBe(false);
    }
  });

  it('borne la note personnelle d’une bouteille', () => {
    expect(updateBottleBodySchema.safeParse({ userNote: tooLong(FIELD_MAX.longText) }).success).toBe(false);
    expect(updateBottleBodySchema.safeParse({ userNote: atMax(FIELD_MAX.longText) }).success).toBe(true);
  });

  it('borne le nom d’une clayette', () => {
    const base = { cellarId: 'c1', capacity: 12 };
    expect(createCrateBodySchema.safeParse({ ...base, name: tooLong(FIELD_MAX.shortText) }).success).toBe(
      false,
    );
  });

  it('borne l’adresse email d’une invitation', () => {
    const local = 'a'.repeat(FIELD_MAX.email);
    expect(
      createInvitationBodySchema.safeParse({ cellarId: 'c1', role: 'reader', email: `${local}@x.fr` })
        .success,
    ).toBe(false);
  });

  it('borne commentaire et occasion d’une consommation', () => {
    expect(consumeBottleBodySchema.safeParse({ comment: tooLong(FIELD_MAX.longText) }).success).toBe(false);
    expect(consumeBottleBodySchema.safeParse({ occasion: tooLong(FIELD_MAX.shortText) }).success).toBe(false);
  });

  it('borne une entrée d’historique modifiée', () => {
    expect(updateHistoryEntryBodySchema.safeParse({ comment: tooLong(FIELD_MAX.longText) }).success).toBe(
      false,
    );
  });

  it('borne les champs d’un item de wishlist', () => {
    expect(
      createWishlistItemBodySchema.safeParse({
        category: 'wine',
        name: tooLong(FIELD_MAX.shortText),
        details: {},
      }).success,
    ).toBe(false);
  });

  it('borne les détails par catégorie, chaîne comme liste', () => {
    expect(wineDetailsSchema.safeParse({ appellation: tooLong(FIELD_MAX.shortText) }).success).toBe(false);
    expect(wineDetailsSchema.safeParse({ grapeVarieties: [tooLong(FIELD_MAX.shortText)] }).success).toBe(
      false,
    );
    expect(
      wineDetailsSchema.safeParse({
        grapeVarieties: Array.from({ length: FIELD_MAX.listItems + 1 }, () => 'Merlot'),
      }).success,
    ).toBe(false);
  });
});
