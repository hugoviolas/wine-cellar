import { describe, it, expect } from 'vitest';
import { isPersonalBottlePatch } from './bottleEditing';

describe('isPersonalBottlePatch', () => {
  it('reconnaît un patch limité à la note personnelle et à la note sur 5', () => {
    expect(isPersonalBottlePatch(['userNote'])).toBe(true);
    expect(isPersonalBottlePatch(['userNote', 'rating'])).toBe(true);
    expect(isPersonalBottlePatch(['rating', 'quantity'])).toBe(false);
  });
});
