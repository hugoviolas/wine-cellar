# Intégration IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add on-demand AI bottle analysis (chantier A) and photo-based bottle-add prefill (chantier B) to "Ma Cave", both backed by a shared Claude client and a shared `isAiAvailable` circuit breaker.

**Architecture:** A small `src/domain/ai/` module holds everything AI-specific: Zod schemas for both Claude response shapes (and the photo route's request body), a lazily-constructed `@anthropic-ai/sdk` client with a generic "call Claude, parse JSON, validate against schema" helper, pure prompt-builder functions per chantier, and a DB-write helper for chantier A's guarded `drinkFrom`/`drinkUntil` update. Two new API routes wire these together behind the existing auth/permission primitives (`requireApiUser`, `resolveBottleAccess`/`checkCellarAccess`, `canEditCellarContent`). Two new small client components (`AiAnalysisButton`, `PhotoFillButton`) call the routes and are wired into the existing bottle-detail and add-bottle pages, gated by `isAiAvailable`.

**Tech Stack:** Next.js App Router route handlers, Drizzle ORM (SQLite, columns already exist — no migration), Zod, `@anthropic-ai/sdk` (new dependency), Vitest for domain-level TDD (this codebase has no route/page-level automated tests — routes and UI are verified live, per existing convention).

**Spec:** `docs/superpowers/specs/2026-09-08-integration-ia-design.md`

## Global Constraints

- One model for both chantiers: `claude-sonnet-5` (never a different model for vision vs. text).
- Use the official `@anthropic-ai/sdk` — no raw `fetch` calls to the Claude API.
- Structured output via prompt + Zod validation only — no tool-use/function-calling, no automatic retry or repair on an invalid/unparseable response (V1: the user retries manually via "Régénérer" or by picking another photo).
- Shared circuit breaker `isAiAvailable(cellar)` = `cellar.aiEnabled === true` AND `ANTHROPIC_API_KEY` is present and non-empty. Both API routes re-check this server-side — never trust the UI hiding the button alone.
- Read `ANTHROPIC_API_KEY` lazily, at call time, not at module load (same reasoning as `SESSION_SECRET` in `src/domain/session.ts`: `next build` imports route files without a real `.env` present).
- Chantier A generation is gated by `canEditCellarContent(role)`. `aiAnalysis`/`aiPairings`/`aiTastingAdvice`/`aiGeneratedAt` are always overwritten, including on regeneration. `drinkFrom`/`drinkUntil` are written **only if currently `null`** — never overwrite a manually-set or previously-AI-set garde window.
- Chantier B extraction is gated by `canEditCellarContent(role)` on the target cellar. The photo is never persisted anywhere (disk, DB, or React state beyond the single request/response cycle). Client-side 5MB size limit, no compression/resize. Crate and quantity are always chosen manually — never prefilled. The extracted `region` field is intentionally ignored by the prefill (the add-bottle form has no region field; out of scope to add one). No changes to the existing `POST /api/bottles` route.
- Explicitly out of scope for this plan: référentiels import (Wikidata/Kaggle), storing or displaying the bottle photo, barcode scanning, automatic retry on invalid AI response, image compression/resizing.

---

### Task 1: Add `@anthropic-ai/sdk` dependency + `isAiAvailable` circuit breaker

**Files:**
- Modify: `package.json` (new dependency, via `yarn add`)
- Modify: `.env.example`
- Create: `src/domain/ai/available.ts`
- Test: `src/domain/ai/available.test.ts`

**Interfaces:**
- Consumes: `hasApiKeyConfigured(): boolean` from `src/domain/supervision.ts` (already exists — checks `process.env.ANTHROPIC_API_KEY` is a non-empty string).
- Produces: `isAiAvailable(cellar: { aiEnabled: boolean }): boolean`, used by Tasks 5, 6, 8, 9.

- [ ] **Step 1: Add the dependency**

Run: `yarn add @anthropic-ai/sdk`

This adds `@anthropic-ai/sdk` (currently `0.124.0`) to `package.json` `dependencies` and updates `yarn.lock`.

- [ ] **Step 2: Document the new env var**

Add this line to `.env.example` (after `BOOTSTRAP_CELLAR_NAME`):

```
ANTHROPIC_API_KEY=
```

- [ ] **Step 3: Write the failing test**

Create `src/domain/ai/available.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { isAiAvailable } from './available';

describe('isAiAvailable', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('vrai si la cave a l’IA activée et qu’une clé API est configurée', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-123');
    expect(isAiAvailable({ aiEnabled: true })).toBe(true);
  });

  it('faux si la cave a désactivé l’IA, même avec une clé configurée', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-123');
    expect(isAiAvailable({ aiEnabled: false })).toBe(false);
  });

  it('faux si aucune clé API n’est configurée, même si la cave l’autorise', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(isAiAvailable({ aiEnabled: true })).toBe(false);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `yarn test src/domain/ai/available.test.ts`
Expected: FAIL — `Cannot find module './available'` (file doesn't exist yet).

- [ ] **Step 5: Write the implementation**

Create `src/domain/ai/available.ts`:

```ts
import { hasApiKeyConfigured } from '../supervision';

export interface AiCellar {
  aiEnabled: boolean;
}

/**
 * Coupe-circuit unique, partagé par les chantiers A (fiche IA) et B (ajout
 * par photo) : IA disponible seulement si la cave l'autorise ET qu'une clé
 * API est configurée. Les deux routes IA revérifient ceci côté serveur —
 * jamais uniquement côté UI, qui l'utilise seulement pour masquer un bouton.
 */
export function isAiAvailable(cellar: AiCellar): boolean {
  return cellar.aiEnabled && hasApiKeyConfigured();
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `yarn test src/domain/ai/available.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Verify types and lint**

Run: `npx tsc --noEmit && yarn lint`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add package.json yarn.lock .env.example src/domain/ai/available.ts src/domain/ai/available.test.ts
git commit -m "$(cat <<'EOF'
feat(ai): add Anthropic SDK dependency and isAiAvailable circuit breaker

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DFrFvcZprFxRSuLNgewZPb
EOF
)"
```

---

### Task 2: AI Zod schemas

**Files:**
- Create: `src/domain/ai/schemas.ts`
- Test: `src/domain/ai/schemas.test.ts`

**Interfaces:**
- Produces:
  - `aiBottleAnalysisSchema` (Zod schema) + `type AiBottleAnalysis` — Claude's response shape for chantier A. Used by Tasks 4, 5.
  - `aiPhotoExtractionSchema` (Zod schema) + `type AiPhotoExtraction` — Claude's response shape for chantier B. Used by Tasks 7, 8.
  - `aiImageMediaTypeSchema` (Zod schema) + `type AiImageMediaType` — the 4 accepted image MIME types, shared by the request-body schema below and by Task 3's client types. Used by Tasks 3, 8, 9.
  - `extractFromPhotoRequestSchema` (Zod schema) + `type ExtractFromPhotoRequest` — the body of `POST /api/bottles/extract-from-photo` (not Claude's response — the client request). Used by Task 8.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/ai/schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  aiBottleAnalysisSchema,
  aiPhotoExtractionSchema,
  extractFromPhotoRequestSchema,
} from './schemas';

describe('aiBottleAnalysisSchema', () => {
  const valid = {
    analysis: 'Un vin structuré avec de beaux tanins.',
    pairings: ['Bœuf braisé', 'Fromages affinés', 'Gibier'],
    tastingAdvice: 'Servir à 16-18°C, carafer 1h avant dégustation.',
    drinkFromYear: 2027,
    drinkUntilYear: 2032,
  };

  it('accepte une réponse conforme', () => {
    expect(aiBottleAnalysisSchema.safeParse(valid).success).toBe(true);
  });

  it('accepte drinkFromYear et drinkUntilYear nuls', () => {
    const result = aiBottleAnalysisSchema.safeParse({ ...valid, drinkFromYear: null, drinkUntilYear: null });
    expect(result.success).toBe(true);
  });

  it('refuse moins de 3 accords', () => {
    const result = aiBottleAnalysisSchema.safeParse({ ...valid, pairings: ['Bœuf', 'Fromage'] });
    expect(result.success).toBe(false);
  });

  it('refuse plus de 5 accords', () => {
    const result = aiBottleAnalysisSchema.safeParse({
      ...valid,
      pairings: ['a', 'b', 'c', 'd', 'e', 'f'],
    });
    expect(result.success).toBe(false);
  });

  it('refuse une analyse vide', () => {
    const result = aiBottleAnalysisSchema.safeParse({ ...valid, analysis: '' });
    expect(result.success).toBe(false);
  });

  it('refuse un champ manquant', () => {
    const { tastingAdvice: _omit, ...incomplete } = valid;
    expect(aiBottleAnalysisSchema.safeParse(incomplete).success).toBe(false);
  });
});

describe('aiPhotoExtractionSchema', () => {
  const valid = {
    name: 'Château Margaux',
    producer: 'Château Margaux',
    vintage: 2018,
    category: 'wine' as const,
    color: 'rouge' as const,
    region: 'Bordeaux',
  };

  it('accepte une réponse conforme', () => {
    expect(aiPhotoExtractionSchema.safeParse(valid).success).toBe(true);
  });

  it('accepte tous les champs à null (photo peu lisible)', () => {
    const allNull = {
      name: null,
      producer: null,
      vintage: null,
      category: null,
      color: null,
      region: null,
    };
    expect(aiPhotoExtractionSchema.safeParse(allNull).success).toBe(true);
  });

  it('refuse une catégorie hors énumération', () => {
    const result = aiPhotoExtractionSchema.safeParse({ ...valid, category: 'digestif' });
    expect(result.success).toBe(false);
  });

  it('refuse une couleur hors énumération', () => {
    const result = aiPhotoExtractionSchema.safeParse({ ...valid, color: 'orange' });
    expect(result.success).toBe(false);
  });
});

describe('extractFromPhotoRequestSchema', () => {
  const valid = { cellarId: 'cellar-1', imageBase64: 'AAAA', mediaType: 'image/jpeg' as const };

  it('accepte un corps conforme', () => {
    expect(extractFromPhotoRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('refuse un mediaType non supporté', () => {
    const result = extractFromPhotoRequestSchema.safeParse({ ...valid, mediaType: 'image/heic' });
    expect(result.success).toBe(false);
  });

  it('refuse un champ supplémentaire (.strict())', () => {
    const result = extractFromPhotoRequestSchema.safeParse({ ...valid, extra: 'nope' });
    expect(result.success).toBe(false);
  });

  it('refuse un imageBase64 vide', () => {
    const result = extractFromPhotoRequestSchema.safeParse({ ...valid, imageBase64: '' });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/domain/ai/schemas.test.ts`
Expected: FAIL — `Cannot find module './schemas'`

- [ ] **Step 3: Write the implementation**

Create `src/domain/ai/schemas.ts`:

```ts
import { z } from 'zod';

/** Réponse attendue de Claude pour la fiche IA à la demande (chantier A). */
export const aiBottleAnalysisSchema = z.object({
  analysis: z.string().min(1),
  pairings: z.array(z.string().min(1)).min(3).max(5),
  tastingAdvice: z.string().min(1),
  drinkFromYear: z.number().int().nullable(),
  drinkUntilYear: z.number().int().nullable(),
});
export type AiBottleAnalysis = z.infer<typeof aiBottleAnalysisSchema>;

/** Réponse attendue de Claude pour l'extraction par photo (chantier B). */
export const aiPhotoExtractionSchema = z.object({
  name: z.string().min(1).nullable(),
  producer: z.string().min(1).nullable(),
  vintage: z.number().int().nullable(),
  category: z.enum(['wine', 'sparkling', 'cider', 'beer', 'spirit']).nullable(),
  color: z.enum(['rouge', 'blanc', 'rose', 'autre']).nullable(),
  region: z.string().min(1).nullable(),
});
export type AiPhotoExtraction = z.infer<typeof aiPhotoExtractionSchema>;

/** Types MIME d'image acceptés par la vision Claude, pour le chantier B. */
export const aiImageMediaTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
export type AiImageMediaType = z.infer<typeof aiImageMediaTypeSchema>;

/** Corps de `POST /api/bottles/extract-from-photo` — la requête du client, pas la réponse de Claude. */
export const extractFromPhotoRequestSchema = z
  .object({
    cellarId: z.string().min(1),
    imageBase64: z.string().min(1),
    mediaType: aiImageMediaTypeSchema,
  })
  .strict();
export type ExtractFromPhotoRequest = z.infer<typeof extractFromPhotoRequestSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/domain/ai/schemas.test.ts`
Expected: PASS (14 tests)

- [ ] **Step 5: Verify types and lint**

Run: `npx tsc --noEmit && yarn lint`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/domain/ai/schemas.ts src/domain/ai/schemas.test.ts
git commit -m "$(cat <<'EOF'
feat(ai): add Zod schemas for AI bottle analysis and photo extraction

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DFrFvcZprFxRSuLNgewZPb
EOF
)"
```

---

### Task 3: Shared Claude client + `callClaudeForJson` helper

**Files:**
- Create: `src/domain/ai/client.ts`
- Test: `src/domain/ai/client.test.ts`

**Interfaces:**
- Consumes: `AiImageMediaType` (Task 2, `src/domain/ai/schemas.ts`).
- Produces:
  - `class AiResponseError extends Error` — thrown when Claude's reply isn't valid JSON or doesn't match the given schema. Used by Tasks 5, 8 to map to a 502 response.
  - `type AiTextBlock = { type: 'text'; text: string }`
  - `type AiImageBlock = { type: 'image'; source: { type: 'base64'; media_type: AiImageMediaType; data: string } }`
  - `type AiMessageContent = string | Array<AiTextBlock | AiImageBlock>` — used by Tasks 4, 7 as the return type of their prompt builders.
  - `async function callClaudeForJson<T>(params: { system: string; content: AiMessageContent; schema: z.ZodType<T> }): Promise<T>` — used by Tasks 5, 8.

**Confirmed SDK call shape** (verified against the official `@anthropic-ai/sdk` README): `new Anthropic({ apiKey })`, then `client.messages.create({ model, max_tokens, system, messages: [{ role: 'user', content }] })`; the reply's text lives at `message.content[0]` when that block's `.type === 'text'`.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/ai/client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

const createMock = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: createMock },
    })),
  };
});

const { callClaudeForJson, AiResponseError } = await import('./client');

describe('callClaudeForJson', () => {
  beforeEach(() => {
    createMock.mockReset();
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-123');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const schema = z.object({ ok: z.boolean() });

  it('parse et valide une réponse JSON conforme', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ ok: true }) }],
    });

    const result = await callClaudeForJson({ system: 'sys', content: 'hello', schema });

    expect(result).toEqual({ ok: true });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-5',
        system: 'sys',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    );
  });

  it('lève AiResponseError si le texte n’est pas du JSON valide', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'pas du json' }] });

    await expect(callClaudeForJson({ system: 'sys', content: 'hello', schema })).rejects.toThrow(
      AiResponseError,
    );
  });

  it('lève AiResponseError si la réponse ne correspond pas au schéma', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ ok: 'pas un booléen' }) }],
    });

    await expect(callClaudeForJson({ system: 'sys', content: 'hello', schema })).rejects.toThrow(
      AiResponseError,
    );
  });

  it('lève AiResponseError si la réponse n’a pas de bloc texte', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'image', source: {} }] });

    await expect(callClaudeForJson({ system: 'sys', content: 'hello', schema })).rejects.toThrow(
      AiResponseError,
    );
  });

  it('lève une erreur si ANTHROPIC_API_KEY est absent', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');

    await expect(callClaudeForJson({ system: 'sys', content: 'hello', schema })).rejects.toThrow();
    expect(createMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/domain/ai/client.test.ts`
Expected: FAIL — `Cannot find module './client'`

- [ ] **Step 3: Write the implementation**

Create `src/domain/ai/client.ts`:

```ts
import Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';
import type { AiImageMediaType } from './schemas';

const MODEL = 'claude-sonnet-5';

/**
 * Clé API lue à l'appel, pas au chargement du module : `next build` importe
 * les fichiers de route pour les analyser, sans qu'une vraie clé soit
 * forcément présente à ce moment — même précaution que SESSION_SECRET
 * (voir src/domain/session.ts).
 */
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY doit être défini pour appeler Claude.');
  }
  return new Anthropic({ apiKey });
}

export class AiResponseError extends Error {}

export type AiTextBlock = { type: 'text'; text: string };
export type AiImageBlock = {
  type: 'image';
  source: { type: 'base64'; media_type: AiImageMediaType; data: string };
};
export type AiMessageContent = string | Array<AiTextBlock | AiImageBlock>;

export interface ClaudeJsonCallParams<T> {
  system: string;
  content: AiMessageContent;
  schema: z.ZodType<T>;
}

/**
 * Envoie un message à Claude, extrait le premier bloc texte de la réponse,
 * le parse en JSON et le valide avec le schéma Zod fourni. Sortie
 * structurée par prompt + validation (pas de tool-use), voir le spec IA.
 * Lève `AiResponseError` si la réponse n'est pas un JSON valide ou ne
 * correspond pas au schéma — pas de nouvelle tentative automatique en V1,
 * l'utilisateur relance manuellement (bouton Régénérer / autre photo).
 */
export async function callClaudeForJson<T>({ system, content, schema }: ClaudeJsonCallParams<T>): Promise<T> {
  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content }],
  });

  const block = message.content[0];
  if (!block || block.type !== 'text') {
    throw new AiResponseError('Réponse Claude sans contenu texte.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(block.text);
  } catch {
    throw new AiResponseError('Réponse Claude non conforme (JSON invalide).');
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new AiResponseError('Réponse Claude non conforme au schéma attendu.');
  }
  return result.data;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/domain/ai/client.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Verify types and lint**

Run: `npx tsc --noEmit && yarn lint`
Expected: no errors. If `content` doesn't structurally satisfy the SDK's expected message-content type, do not weaken it with `any`/`as never` — check whether `media_type` needs to come from the SDK's own literal union instead of ours; the shapes should otherwise match the API's documented wire format exactly.

- [ ] **Step 6: Commit**

```bash
git add src/domain/ai/client.ts src/domain/ai/client.test.ts
git commit -m "$(cat <<'EOF'
feat(ai): add shared Claude client with JSON-call-and-validate helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DFrFvcZprFxRSuLNgewZPb
EOF
)"
```

---

### Task 4: Chantier A — prompt builder + guarded DB write

**Files:**
- Create: `src/domain/ai/bottleAnalysis.ts`
- Test: `src/domain/ai/bottleAnalysis.test.ts`

**Interfaces:**
- Consumes: `AiMessageContent` (Task 3), `AiBottleAnalysis` (Task 2), `Db` (`src/db/client.ts`), `bottles` table (`src/db/schema.ts`), `createTestDb` (`src/db/testDb.ts`), `bootstrapSuperAdmin` (`src/domain/bootstrap.ts`), `createCrate` (`src/domain/crates.ts`), `createBottle`/`getBottle` (`src/domain/bottles.ts`).
- Produces:
  - `function buildBottleAnalysisPrompt(bottle: { name: string; producer: string | null; vintage: number | null; category: string; region: string | null }): { system: string; content: AiMessageContent }` — used by Task 5.
  - `async function saveBottleAiAnalysis(db: Db, bottle: { id: string; drinkFrom: number | null; drinkUntil: number | null }, analysis: AiBottleAnalysis): Promise<void>` — used by Task 5.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/ai/bottleAnalysis.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../../db/testDb';
import { bootstrapSuperAdmin } from '../bootstrap';
import { createCrate } from '../crates';
import { createBottle, getBottle } from '../bottles';
import { bottles } from '../../db/schema';
import { buildBottleAnalysisPrompt, saveBottleAiAnalysis } from './bottleAnalysis';

describe('buildBottleAnalysisPrompt', () => {
  it('inclut les champs de la bouteille dans le prompt', () => {
    const { content } = buildBottleAnalysisPrompt({
      name: 'Château Margaux',
      producer: 'Château Margaux SA',
      vintage: 2015,
      category: 'wine',
      region: 'Bordeaux',
    });

    expect(typeof content).toBe('string');
    const text = content as string;
    expect(text).toContain('Château Margaux');
    expect(text).toContain('Château Margaux SA');
    expect(text).toContain('2015');
    expect(text).toContain('wine');
    expect(text).toContain('Bordeaux');
    expect(text).toContain('3 à 5');
  });

  it('gère les champs absents sans planter', () => {
    const { content } = buildBottleAnalysisPrompt({
      name: 'Cidre mystère',
      producer: null,
      vintage: null,
      category: 'cider',
      region: null,
    });

    expect(content as string).toContain('Cidre mystère');
    expect(content as string).toContain('inconnu');
  });
});

describe('saveBottleAiAnalysis', () => {
  async function setupBottle() {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'x',
      cellarName: 'Cave',
    });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const bottleId = await createBottle(db, {
      crateId,
      category: 'wine',
      name: 'Vin test',
      quantity: 1,
      details: {},
    });
    return { db, bottleId };
  }

  const analysis = {
    analysis: 'Un vin bien structuré.',
    pairings: ['Bœuf', 'Fromage', 'Gibier'],
    tastingAdvice: 'Servir à 16°C.',
    drinkFromYear: 2027,
    drinkUntilYear: 2032,
  };

  it('écrit les champs IA et la fenêtre de garde quand elle est vide', async () => {
    const { db, bottleId } = await setupBottle();
    const before = await getBottle(db, bottleId);
    expect(before?.drinkFrom).toBeNull();
    expect(before?.drinkUntil).toBeNull();

    await saveBottleAiAnalysis(db, { id: bottleId, drinkFrom: null, drinkUntil: null }, analysis);

    const after = await getBottle(db, bottleId);
    expect(after?.aiAnalysis).toBe(analysis.analysis);
    expect(after?.aiPairings).toEqual(analysis.pairings);
    expect(after?.aiTastingAdvice).toBe(analysis.tastingAdvice);
    expect(after?.aiGeneratedAt).toBeTruthy();
    expect(after?.drinkFrom).toBe(2027);
    expect(after?.drinkUntil).toBe(2032);
  });

  it('n’écrase pas une fenêtre de garde déjà renseignée', async () => {
    const { db, bottleId } = await setupBottle();
    await db.update(bottles).set({ drinkFrom: 2020, drinkUntil: 2024 }).where(eq(bottles.id, bottleId));

    await saveBottleAiAnalysis(db, { id: bottleId, drinkFrom: 2020, drinkUntil: 2024 }, analysis);

    const after = await getBottle(db, bottleId);
    expect(after?.drinkFrom).toBe(2020);
    expect(after?.drinkUntil).toBe(2024);
    // Les champs IA eux sont toujours écrasés, y compris à la régénération.
    expect(after?.aiAnalysis).toBe(analysis.analysis);
  });

  it('remplace le contenu IA précédent lors d’une régénération', async () => {
    const { db, bottleId } = await setupBottle();
    await saveBottleAiAnalysis(db, { id: bottleId, drinkFrom: null, drinkUntil: null }, analysis);

    const secondAnalysis = { ...analysis, analysis: 'Nouvelle analyse.', pairings: ['Volaille', 'Poisson', 'Fromage'] };
    await saveBottleAiAnalysis(db, { id: bottleId, drinkFrom: 2027, drinkUntil: 2032 }, secondAnalysis);

    const after = await getBottle(db, bottleId);
    expect(after?.aiAnalysis).toBe('Nouvelle analyse.');
    expect(after?.aiPairings).toEqual(['Volaille', 'Poisson', 'Fromage']);
    // La garde était déjà remplie par le premier appel : pas réécrasée par le second.
    expect(after?.drinkFrom).toBe(2027);
    expect(after?.drinkUntil).toBe(2032);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/domain/ai/bottleAnalysis.test.ts`
Expected: FAIL — `Cannot find module './bottleAnalysis'`

- [ ] **Step 3: Write the implementation**

Create `src/domain/ai/bottleAnalysis.ts`:

```ts
import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { bottles } from '../../db/schema';
import type { AiMessageContent } from './client';
import type { AiBottleAnalysis } from './schemas';

export interface BottleAnalysisInput {
  name: string;
  producer: string | null;
  vintage: number | null;
  category: string;
  region: string | null;
}

export function buildBottleAnalysisPrompt(bottle: BottleAnalysisInput): { system: string; content: AiMessageContent } {
  const system =
    'Tu es un sommelier expert. Tu réponds uniquement avec un objet JSON valide, sans texte avant ni après, correspondant exactement au schéma demandé.';
  const content = `Analyse cette bouteille et réponds avec un objet JSON de cette forme exacte :
{
  "analysis": "string — 2 à 4 phrases d'analyse du profil du vin",
  "pairings": ["string", "..."],
  "tastingAdvice": "string — conseils de service (température, carafage, verre...)",
  "drinkFromYear": 2027,
  "drinkUntilYear": 2032
}

"pairings" contient 3 à 5 suggestions d'accords mets-vin. "drinkFromYear" et "drinkUntilYear" sont des entiers (années) ou null si tu n'as pas assez d'éléments pour estimer une fenêtre de garde (par exemple une bouteille sans millésime, ou une catégorie sans notion de garde comme la bière).

Bouteille :
- Nom : ${bottle.name}
- Producteur : ${bottle.producer ?? 'inconnu'}
- Millésime : ${bottle.vintage ?? 'inconnu'}
- Catégorie : ${bottle.category}
- Région : ${bottle.region ?? 'inconnue'}`;
  return { system, content };
}

export interface BottleForAiSave {
  id: string;
  drinkFrom: number | null;
  drinkUntil: number | null;
}

/**
 * `aiAnalysis`/`aiPairings`/`aiTastingAdvice`/`aiGeneratedAt` sont toujours
 * écrasés, y compris à la régénération. `drinkFrom`/`drinkUntil` ne sont
 * écrits que si la bouteille n'a actuellement pas de valeur — une fenêtre
 * de garde déjà renseignée (manuellement ou par une génération précédente)
 * n'est jamais écrasée (voir le spec IA, section Chantier A).
 */
export async function saveBottleAiAnalysis(
  db: Db,
  bottle: BottleForAiSave,
  analysis: AiBottleAnalysis,
): Promise<void> {
  const set: {
    aiAnalysis: string;
    aiPairings: string[];
    aiTastingAdvice: string;
    aiGeneratedAt: string;
    drinkFrom?: number;
    drinkUntil?: number;
  } = {
    aiAnalysis: analysis.analysis,
    aiPairings: analysis.pairings,
    aiTastingAdvice: analysis.tastingAdvice,
    aiGeneratedAt: new Date().toISOString(),
  };
  if (bottle.drinkFrom === null && analysis.drinkFromYear !== null) set.drinkFrom = analysis.drinkFromYear;
  if (bottle.drinkUntil === null && analysis.drinkUntilYear !== null) set.drinkUntil = analysis.drinkUntilYear;

  await db.update(bottles).set(set).where(eq(bottles.id, bottle.id));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/domain/ai/bottleAnalysis.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Verify types and lint**

Run: `npx tsc --noEmit && yarn lint`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/domain/ai/bottleAnalysis.ts src/domain/ai/bottleAnalysis.test.ts
git commit -m "$(cat <<'EOF'
feat(ai): add chantier A prompt builder and guarded analysis save

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DFrFvcZprFxRSuLNgewZPb
EOF
)"
```

---

### Task 5: Chantier A route — `POST /api/bottles/[id]/ai-generate`

**Files:**
- Create: `src/app/api/bottles/[id]/ai-generate/route.ts`

**Interfaces:**
- Consumes: `requireApiUser` (`src/lib/requireApiUser.ts`), `resolveBottleAccess` (`src/domain/bottleAccess.ts`), `canEditCellarContent` (`src/domain/permissions.ts`), `getCrateById` (`src/domain/crates.ts`), `getCellarById` (`src/domain/cellars.ts`), `isAiAvailable` (Task 1), `buildBottleAnalysisPrompt`/`saveBottleAiAnalysis` (Task 4), `aiBottleAnalysisSchema` (Task 2), `callClaudeForJson`/`AiResponseError` (Task 3), `db` (`src/db/client.ts`).
- Produces: the route itself, consumed by Task 6's UI.

This codebase has no route-level automated tests (routes are thin glue over tested domain functions, verified live) — this task has no test step. It is verified manually in the Post-Implementation Manual Verification section at the end of this plan.

- [ ] **Step 1: Write the route**

Create `src/app/api/bottles/[id]/ai-generate/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { resolveBottleAccess } from '@/domain/bottleAccess';
import { canEditCellarContent } from '@/domain/permissions';
import { getCrateById } from '@/domain/crates';
import { getCellarById } from '@/domain/cellars';
import { isAiAvailable } from '@/domain/ai/available';
import { buildBottleAnalysisPrompt, saveBottleAiAnalysis } from '@/domain/ai/bottleAnalysis';
import { aiBottleAnalysisSchema } from '@/domain/ai/schemas';
import { callClaudeForJson, AiResponseError } from '@/domain/ai/client';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  const access = await resolveBottleAccess(db, auth.user.id, id);
  if (access.status === 'not_found') {
    return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  }
  if (access.status === 'forbidden') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  if (!canEditCellarContent(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  // access.status === 'ok' garantit bottle.crateId non nul (voir bottleAccess.ts).
  const crate = await getCrateById(db, access.bottle.crateId as string);
  const cellar = crate ? await getCellarById(db, crate.cellarId) : null;
  if (!cellar || !isAiAvailable(cellar)) {
    return NextResponse.json({ error: 'Fonction IA indisponible pour cette cave.' }, { status: 403 });
  }

  const { system, content } = buildBottleAnalysisPrompt(access.bottle);

  let analysis;
  try {
    analysis = await callClaudeForJson({ system, content, schema: aiBottleAnalysisSchema });
  } catch (err) {
    if (err instanceof AiResponseError) {
      return NextResponse.json({ error: 'Réponse IA invalide, réessaie.' }, { status: 502 });
    }
    return NextResponse.json({ error: 'Appel IA impossible pour le moment.' }, { status: 502 });
  }

  await saveBottleAiAnalysis(db, access.bottle, analysis);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit && yarn lint`
Expected: no errors

- [ ] **Step 3: Verify the build**

Run: `yarn build`
Expected: succeeds (confirms the route compiles and `ANTHROPIC_API_KEY` not being set locally doesn't break the build, per the lazy-read constraint)

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/bottles/[id]/ai-generate/route.ts"
git commit -m "$(cat <<'EOF'
feat(ai): add POST /api/bottles/[id]/ai-generate route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DFrFvcZprFxRSuLNgewZPb
EOF
)"
```

---

### Task 6: Chantier A UI — Générer/Régénérer button + Accords mets-vin section

**Files:**
- Create: `src/components/AiAnalysisButton.tsx`
- Modify: `src/app/(app)/bottles/[id]/page.tsx`

**Interfaces:**
- Consumes: `useToast` (`src/components/Toast.tsx`), the route from Task 5, `getCellarById` (`src/domain/cellars.ts`), `isAiAvailable` (Task 1).
- Produces: `AiAnalysisButton({ bottleId, hasAnalysis }: { bottleId: string; hasAnalysis: boolean })`, rendered from the bottle detail page.

No automated test for this task (client component + page wiring — this codebase verifies UI live, per existing convention). Verified manually in the Post-Implementation Manual Verification section.

- [ ] **Step 1: Create the button component**

Create `src/components/AiAnalysisButton.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';

export function AiAnalysisButton({ bottleId, hasAnalysis }: { bottleId: string; hasAnalysis: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    const response = await fetch(`/api/bottles/${bottleId}/ai-generate`, { method: 'POST' });
    setBusy(false);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const message = typeof data?.error === 'string' ? data.error : 'Impossible de générer l’analyse IA.';
      toast.error(message);
      return;
    }
    toast.success('Analyse IA générée.');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={generate}
      disabled={busy}
      className="border border-forest text-forest rounded px-3 py-2 text-sm mb-6"
    >
      {busy ? 'Génération…' : hasAnalysis ? 'Régénérer l’analyse IA' : 'Générer l’analyse IA'}
    </button>
  );
}
```

- [ ] **Step 2: Wire it into the bottle detail page**

Replace the full content of `src/app/(app)/bottles/[id]/page.tsx` with:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { resolveBottleAccess } from '@/domain/bottleAccess';
import { computeGardeStatus, computeGardeProgress } from '@/domain/gardeStatus';
import { getCrateById, listCrates } from '@/domain/crates';
import { getCellarById } from '@/domain/cellars';
import { isAiAvailable } from '@/domain/ai/available';
import { GardeBadge } from '@/components/GardeBadge';
import { GardeGauge } from '@/components/GardeGauge';
import { UserNoteEditor } from '@/components/UserNoteEditor';
import { BottleActions } from '@/components/BottleActions';
import { EditBottleForm } from '@/components/EditBottleForm';
import { AiAnalysisButton } from '@/components/AiAnalysisButton';
import { wineColorStripeClass } from '@/lib/wineColor';

export default async function BottleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const access = await resolveBottleAccess(db, user.id, id);
  if (access.status !== 'ok') notFound();
  const bottle = access.bottle;

  // bottle.crateId est garanti non nul : resolveBottleAccess exclut les
  // bouteilles orphelines (voir bottleAccess.ts).
  const currentCrate = await getCrateById(db, bottle.crateId as string);
  const siblingCrates = currentCrate
    ? (await listCrates(db, currentCrate.cellarId)).filter((c) => c.id !== currentCrate.id)
    : [];
  const cellar = currentCrate ? await getCellarById(db, currentCrate.cellarId) : null;
  const aiAvailable = cellar ? isAiAvailable(cellar) : false;
  const pairings = Array.isArray(bottle.aiPairings) ? (bottle.aiPairings as string[]) : [];

  const currentYear = new Date().getFullYear();
  const status = computeGardeStatus(bottle.drinkFrom, bottle.drinkUntil, currentYear);
  const progress = computeGardeProgress(bottle.vintage, bottle.drinkUntil, currentYear);

  return (
    <div className="max-w-lg">
      <Link href="/cave" className="text-xs text-forest mb-2 inline-block">← Retour à la cave</Link>
      <div className={`pl-4 ${wineColorStripeClass(bottle.color)}`}>
      <h2 className="text-xl mb-1">{bottle.name}</h2>
      <p className="text-xs text-gray-500 mb-4">
        {bottle.vintage ?? 'NV'} · {bottle.region ?? '—'} · {bottle.category}
      </p>

      <div className="flex gap-2 mb-6">
        <GardeBadge status={status} />
        <span className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1">
          {bottle.quantity} bouteille{bottle.quantity > 1 ? 's' : ''} en cave
        </span>
      </div>
      </div>

      <section className="mb-6">
        <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Fenêtre de garde</h4>
        <GardeGauge
          progress={progress}
          vintage={bottle.vintage}
          drinkFrom={bottle.drinkFrom}
          drinkUntil={bottle.drinkUntil}
        />
      </section>

      {aiAvailable && (
        <AiAnalysisButton bottleId={bottle.id} hasAnalysis={Boolean(bottle.aiGeneratedAt)} />
      )}

      {bottle.aiAnalysis && (
        <section className="mb-6">
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Analyse</h4>
          <p className="text-sm italic font-serif">{bottle.aiAnalysis}</p>
        </section>
      )}

      {pairings.length > 0 && (
        <section className="mb-6">
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Accords mets-vin</h4>
          <div className="flex flex-wrap gap-2">
            {pairings.map((pairing) => (
              <span key={pairing} className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1">
                {pairing}
              </span>
            ))}
          </div>
        </section>
      )}

      {bottle.aiTastingAdvice && (
        <section className="mb-6">
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Conseils de dégustation</h4>
          <p className="text-sm italic font-serif">{bottle.aiTastingAdvice}</p>
        </section>
      )}

      <section className="mb-6">
        <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Ta note</h4>
        <UserNoteEditor bottleId={bottle.id} initialNote={bottle.userNote} initialRating={bottle.rating} />
      </section>

      <section className="mb-6">
        <EditBottleForm
          bottle={{
            id: bottle.id,
            category: bottle.category,
            name: bottle.name,
            producer: bottle.producer,
            vintage: bottle.vintage,
            region: bottle.region,
            color: bottle.color,
            abv: bottle.abv,
            volumeMl: bottle.volumeMl,
          }}
        />
      </section>

      <BottleActions bottleId={bottle.id} otherCrates={siblingCrates} initialQuantity={bottle.quantity} />

      <a
        href={`/bottles/${bottle.id}/consommer`}
        className="inline-block bg-forest text-cream rounded px-4 py-2 text-sm"
      >
        Consommer une bouteille
      </a>
    </div>
  );
}
```

- [ ] **Step 3: Verify types, lint, and build**

Run: `npx tsc --noEmit && yarn lint && yarn build`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/AiAnalysisButton.tsx "src/app/(app)/bottles/[id]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(ai): wire Générer/Régénérer button and Accords mets-vin section into bottle detail page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DFrFvcZprFxRSuLNgewZPb
EOF
)"
```

---

### Task 7: Chantier B — photo extraction prompt builder

**Files:**
- Create: `src/domain/ai/photoExtraction.ts`
- Test: `src/domain/ai/photoExtraction.test.ts`

**Interfaces:**
- Consumes: `AiImageBlock`/`AiTextBlock`/`AiMessageContent` (Task 3), `AiImageMediaType` (Task 2).
- Produces: `function buildPhotoExtractionPrompt(imageBase64: string, mediaType: AiImageMediaType): { system: string; content: AiMessageContent }` — used by Task 8.

- [ ] **Step 1: Write the failing test**

Create `src/domain/ai/photoExtraction.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildPhotoExtractionPrompt } from './photoExtraction';

describe('buildPhotoExtractionPrompt', () => {
  it('place l’image en premier bloc avec le bon media_type et les bonnes données', () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/domain/ai/photoExtraction.test.ts`
Expected: FAIL — `Cannot find module './photoExtraction'`

- [ ] **Step 3: Write the implementation**

Create `src/domain/ai/photoExtraction.ts`:

```ts
import type { AiImageBlock, AiMessageContent, AiTextBlock } from './client';
import type { AiImageMediaType } from './schemas';

export function buildPhotoExtractionPrompt(
  imageBase64: string,
  mediaType: AiImageMediaType,
): { system: string; content: AiMessageContent } {
  const system =
    'Tu es un sommelier expert. Tu réponds uniquement avec un objet JSON valide, sans texte avant ni après, correspondant exactement au schéma demandé.';

  const imageBlock: AiImageBlock = {
    type: 'image',
    source: { type: 'base64', media_type: mediaType, data: imageBase64 },
  };

  const textBlock: AiTextBlock = {
    type: 'text',
    text: `Extrais les informations visibles sur l'étiquette de cette photo de bouteille et réponds avec un objet JSON de cette forme exacte :
{
  "name": "string | null",
  "producer": "string | null",
  "vintage": 2018,
  "category": "wine",
  "color": "rouge",
  "region": "string | null"
}

"category" est une supposition parmi ces 5 valeurs exactement : "wine", "sparkling", "cider", "beer", "spirit" — choisis celle qui correspond le mieux à ce que tu vois sur l'étiquette. "color" n'est pertinent que si "category" vaut "wine" (valeurs possibles : "rouge", "blanc", "rose", "autre", ou null si indéterminable). Tous les champs sont nullable : si tu ne détectes pas une information avec certitude, laisse-la à null plutôt que d'inventer une valeur.`,
  };

  return { system, content: [imageBlock, textBlock] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/domain/ai/photoExtraction.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Verify types and lint**

Run: `npx tsc --noEmit && yarn lint`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/domain/ai/photoExtraction.ts src/domain/ai/photoExtraction.test.ts
git commit -m "$(cat <<'EOF'
feat(ai): add chantier B photo extraction prompt builder

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DFrFvcZprFxRSuLNgewZPb
EOF
)"
```

---

### Task 8: Chantier B route — `POST /api/bottles/extract-from-photo`

**Files:**
- Create: `src/app/api/bottles/extract-from-photo/route.ts`

**Interfaces:**
- Consumes: `requireApiUser` (`src/lib/requireApiUser.ts`), `checkCellarAccess` (`src/domain/access.ts`), `canEditCellarContent` (`src/domain/permissions.ts`), `getCellarById` (`src/domain/cellars.ts`), `isAiAvailable` (Task 1), `extractFromPhotoRequestSchema`/`aiPhotoExtractionSchema` (Task 2), `buildPhotoExtractionPrompt` (Task 7), `callClaudeForJson`/`AiResponseError` (Task 3), `db` (`src/db/client.ts`).
- Produces: the route itself, consumed by Task 9's UI. Response body on success: `AiPhotoExtraction` (Task 2) as JSON.

No test step, same reasoning as Task 5 (routes are thin glue, verified live).

- [ ] **Step 1: Write the route**

Create `src/app/api/bottles/extract-from-photo/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { checkCellarAccess } from '@/domain/access';
import { canEditCellarContent } from '@/domain/permissions';
import { getCellarById } from '@/domain/cellars';
import { isAiAvailable } from '@/domain/ai/available';
import { extractFromPhotoRequestSchema, aiPhotoExtractionSchema } from '@/domain/ai/schemas';
import { buildPhotoExtractionPrompt } from '@/domain/ai/photoExtraction';
import { callClaudeForJson, AiResponseError } from '@/domain/ai/client';

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;

  const rawBody = await request.json().catch(() => null);
  const parsed = extractFromPhotoRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }
  const { cellarId, imageBase64, mediaType } = parsed.data;

  const access = await checkCellarAccess(db, auth.user.id, cellarId);
  if (!access.allowed) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  if (!canEditCellarContent(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  const cellar = await getCellarById(db, cellarId);
  if (!cellar || !isAiAvailable(cellar)) {
    return NextResponse.json({ error: 'Fonction IA indisponible pour cette cave.' }, { status: 403 });
  }

  const { system, content } = buildPhotoExtractionPrompt(imageBase64, mediaType);
  try {
    const extracted = await callClaudeForJson({ system, content, schema: aiPhotoExtractionSchema });
    return NextResponse.json(extracted);
  } catch (err) {
    if (err instanceof AiResponseError) {
      return NextResponse.json({ error: 'Réponse IA invalide, réessaie avec une autre photo.' }, { status: 502 });
    }
    return NextResponse.json({ error: 'Appel IA impossible pour le moment.' }, { status: 502 });
  }
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit && yarn lint`
Expected: no errors

- [ ] **Step 3: Verify the build**

Run: `yarn build`
Expected: succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/api/bottles/extract-from-photo/route.ts
git commit -m "$(cat <<'EOF'
feat(ai): add POST /api/bottles/extract-from-photo route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DFrFvcZprFxRSuLNgewZPb
EOF
)"
```

---

### Task 9: Chantier B UI — photo picker + AddBottleForm prefill

**Files:**
- Create: `src/components/PhotoFillButton.tsx`
- Modify: `src/components/AddBottleForm.tsx`
- Modify: `src/app/(app)/cave/ajouter/page.tsx`

**Interfaces:**
- Consumes: `useToast` (`src/components/Toast.tsx`), the route from Task 8, `getCellarById` (`src/domain/cellars.ts`), `isAiAvailable` (Task 1).
- Produces: `PhotoFillButton({ cellarId, onExtracted }: { cellarId: string; onExtracted: (data: PhotoExtractionResult) => void })` and its exported `PhotoExtractionResult` type, consumed by `AddBottleForm`.

No automated test for this task, same reasoning as Task 6. Verified manually in the Post-Implementation Manual Verification section.

- [ ] **Step 1: Create the photo picker component**

Create `src/components/PhotoFillButton.tsx`:

```tsx
'use client';

import { useRef, useState } from 'react';
import { useToast } from '@/components/Toast';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type AcceptedMediaType = (typeof ACCEPTED_MEDIA_TYPES)[number];

export interface PhotoExtractionResult {
  name: string | null;
  producer: string | null;
  vintage: number | null;
  category: 'wine' | 'sparkling' | 'cider' | 'beer' | 'spirit' | null;
  color: 'rouge' | 'blanc' | 'rose' | 'autre' | null;
  region: string | null;
}

function isAcceptedMediaType(type: string): type is AcceptedMediaType {
  return (ACCEPTED_MEDIA_TYPES as readonly string[]).includes(type);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result: "data:image/jpeg;base64,AAAA..." — on ne garde que la
      // partie après la virgule ; la photo elle-même n'est jamais conservée
      // au-delà de cet appel (pas de persistance, voir le spec IA).
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function PhotoFillButton({
  cellarId,
  onExtracted,
}: {
  cellarId: string;
  onExtracted: (data: PhotoExtractionResult) => void;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_BYTES) {
      toast.error('Photo trop volumineuse (5 Mo maximum).');
      return;
    }
    if (!isAcceptedMediaType(file.type)) {
      toast.error('Format de photo non supporté (JPEG, PNG, GIF ou WebP attendu).');
      return;
    }

    setBusy(true);
    try {
      const imageBase64 = await fileToBase64(file);
      const response = await fetch('/api/bottles/extract-from-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cellarId, imageBase64, mediaType: file.type }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = typeof data?.error === 'string' ? data.error : 'Impossible d’analyser cette photo.';
        toast.error(message);
        return;
      }
      const extracted: PhotoExtractionResult = await response.json();
      onExtracted(extracted);
      toast.success('Champs pré-remplis depuis la photo — vérifie-les avant d’ajouter.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="border border-forest text-forest rounded px-3 py-2 text-sm"
      >
        {busy ? 'Analyse en cours…' : 'Remplir depuis une photo'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into AddBottleForm**

Replace the full content of `src/components/AddBottleForm.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { crateLabel } from '@/lib/crateLabel';
import { WINE_COLOR_LABELS } from '@/lib/wineColor';
import { CATEGORY_LABELS } from '@/lib/bottleCategory';
import { useToast } from '@/components/Toast';
import { PhotoFillButton, type PhotoExtractionResult } from '@/components/PhotoFillButton';

interface Crate {
  id: string;
  number: number;
  name: string | null;
}

export function AddBottleForm({
  crates,
  cellarId,
  aiAvailable,
}: {
  crates: Crate[];
  cellarId: string;
  aiAvailable: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [crateId, setCrateId] = useState(crates[0]?.id ?? '');
  const [category, setCategory] = useState('wine');
  const [color, setColor] = useState('');
  const [name, setName] = useState('');
  const [producer, setProducer] = useState('');
  const [vintage, setVintage] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  function applyExtraction(data: PhotoExtractionResult) {
    if (data.name) setName(data.name);
    if (data.producer) setProducer(data.producer);
    if (data.vintage) setVintage(String(data.vintage));
    if (data.category) {
      setCategory(data.category);
      if (data.category === 'wine' && data.color) {
        setColor(data.color);
      } else if (data.category !== 'wine') {
        setColor('');
      }
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch('/api/bottles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        crateId,
        category,
        name,
        producer: producer || undefined,
        color: category === 'wine' && color ? color : undefined,
        vintage: vintage ? Number(vintage) : undefined,
        quantity,
        details: {},
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const message = data.error ?? 'Impossible d’ajouter cette bouteille.';
      setError(message);
      toast.error(message);
      return;
    }
    toast.success('Bouteille ajoutée.');
    router.push('/cave');
    router.refresh();
  }

  return (
    <div className="max-w-md">
      {aiAvailable && (
        <div className="mb-4">
          <PhotoFillButton cellarId={cellarId} onExtracted={applyExtraction} />
          <p className="text-xs text-gray-500 mt-1">
            Vérifie et corrige les champs pré-remplis avant d’ajouter — la clayette et la quantité restent à choisir toi-même.
          </p>
        </div>
      )}

    <form onSubmit={handleSubmit} className="bg-white rounded p-6 max-w-md space-y-4">
      {error && <p className="text-sm text-red-700">{error}</p>}

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Clayette</label>
        <select
          value={crateId}
          onChange={(e) => setCrateId(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          required
        >
          {crates.map((crate) => (
            <option key={crate.id} value={crate.id}>{crateLabel(crate.number, crate.name)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Catégorie</label>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            if (e.target.value !== 'wine') setColor('');
          }}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        >
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {category === 'wine' && (
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Couleur</label>
          <select
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {Object.entries(WINE_COLOR_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Nom</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          placeholder="Château Margaux"
          required
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Producteur</label>
        <input
          value={producer}
          onChange={(e) => setProducer(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Millésime</label>
          <input
            value={vintage}
            onChange={(e) => setVintage(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-28"
            placeholder="2015"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Quantité</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-24"
            min={1}
            required
          />
        </div>
      </div>

      <button type="submit" className="bg-forest text-cream rounded px-4 py-2 text-sm">
        Ajouter à la cave
      </button>
    </form>
    </div>
  );
}
```

- [ ] **Step 3: Wire cellarId and aiAvailable from the add-bottle page**

Replace the full content of `src/app/(app)/cave/ajouter/page.tsx` with:

```tsx
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { cellarMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { listCrates } from '@/domain/crates';
import { getCellarById } from '@/domain/cellars';
import { isAiAvailable } from '@/domain/ai/available';
import { AddBottleForm } from '@/components/AddBottleForm';

export default async function AddBottlePage() {
  const user = await requireUser();
  const [membership] = await db
    .select()
    .from(cellarMemberships)
    .where(eq(cellarMemberships.userId, user.id))
    .orderBy(cellarMemberships.createdAt)
    .limit(1);

  const crates = membership ? await listCrates(db, membership.cellarId) : [];
  const cellar = membership ? await getCellarById(db, membership.cellarId) : null;
  const aiAvailable = cellar ? isAiAvailable(cellar) : false;

  return (
    <div>
      <h2 className="text-lg mb-4">Ajouter une bouteille</h2>
      {crates.length === 0 || !membership ? (
        <p className="text-sm">Crée d’abord une clayette avant d’ajouter une bouteille.</p>
      ) : (
        <AddBottleForm crates={crates} cellarId={membership.cellarId} aiAvailable={aiAvailable} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify types, lint, and build**

Run: `npx tsc --noEmit && yarn lint && yarn build`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/PhotoFillButton.tsx src/components/AddBottleForm.tsx "src/app/(app)/cave/ajouter/page.tsx"
git commit -m "$(cat <<'EOF'
feat(ai): wire photo-fill button into add-bottle form

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DFrFvcZprFxRSuLNgewZPb
EOF
)"
```

---

## Post-Implementation Manual Verification

Not an SDD task — this is performed by the controlling session (not delegated to an implementer subagent) after all 9 tasks are implemented and reviewed, the same way live browser verification has been done for every prior chantier this session. Requires a real `ANTHROPIC_API_KEY` in `.env` (ask the user for one if not already configured) and a running `docker compose restart start` (or `yarn dev`).

**Circuit breaker (both chantiers):**
1. With `ANTHROPIC_API_KEY` unset or the cellar's `aiEnabled` false: confirm the "Générer l'analyse IA" button is absent on `/bottles/[id]` and "Remplir depuis une photo" is absent on `/cave/ajouter`.
2. With both conditions satisfied: confirm both controls appear.

**Chantier A (`/bottles/[id]`):**
3. Click "Générer l'analyse IA" on a bottle with no prior AI content. Confirm a toast confirms success, the page shows Analyse / Accords mets-vin (as pastilles) / Conseils de dégustation with real content, and the button now reads "Régénérer l'analyse IA".
4. If the bottle had no `drinkFrom`/`drinkUntil`, confirm the Fenêtre de garde gauge now reflects the AI-estimated years.
5. Click "Régénérer l'analyse IA". Confirm the analysis/pairings/tasting-advice content changes but the garde window years stay exactly as they were after step 3 (not overwritten).
6. On a bottle with a manually-set garde window (via the existing edit form) that has never been AI-analyzed, generate an analysis and confirm the manual garde window is preserved untouched.

**Chantier B (`/cave/ajouter`):**
7. Click "Remplir depuis une photo", pick a real wine-label photo. Confirm a busy state shows, then a success toast, and the Nom/Producteur/Millésime/Catégorie/Couleur fields are prefilled with plausible values (verify at least one field the label clearly shows, e.g. the name).
8. Confirm Clayette and Quantité are unaffected by the prefill (still whatever they were before).
9. Edit a prefilled field, then submit the form normally; confirm the bottle is created with the edited values via the existing `/cave` view.
10. Try a file over 5MB (or a non-image file renamed with an image extension, if that's easier to produce): confirm a clear client-side error toast appears and no network request is sent (check via the browser's network tab or `read_network_requests`).

**Mobile check:** resize to a mobile width and confirm both new buttons and the pairings pastilles remain usable and don't overflow, consistent with the mobile-responsive pass done earlier this session.

Once all of the above pass, proceed with `superpowers:finishing-a-development-branch` to close out the branch.
