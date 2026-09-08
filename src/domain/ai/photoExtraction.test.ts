import { describe, it, expect } from 'vitest';
import { buildPhotoExtractionPrompt } from './photoExtraction';

describe('buildPhotoExtractionPrompt', () => {
  it('place l\'image en premier bloc avec le bon media_type et les bonnes données', () => {
    const { content } = buildPhotoExtractionPrompt('AAAA_base64_data', 'image/jpeg');

    expect(Array.isArray(content)).toBe(true);
    const blocks = content as Array<{ type: string; [key: string]: unknown }>;
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA_base64_data' },
    });
  });

  it('place le prompt texte en second bloc avec les catégories et couleurs attendues', () => {
    const { content } = buildPhotoExtractionPrompt('AAAA', 'image/png');
    const blocks = content as Array<{ type: string; text?: string }>;

    expect(blocks[1].type).toBe('text');
    const text = blocks[1].text as string;
    expect(text).toContain('wine');
    expect(text).toContain('sparkling');
    expect(text).toContain('cider');
    expect(text).toContain('beer');
    expect(text).toContain('spirit');
    expect(text).toContain('rouge');
    expect(text).toContain('blanc');
    expect(text).toContain('rose');
    expect(text).toContain('autre');
  });

  it('utilise un system prompt demandant du JSON seul', () => {
    const { system } = buildPhotoExtractionPrompt('AAAA', 'image/jpeg');
    expect(system.toLowerCase()).toContain('json');
  });
});
