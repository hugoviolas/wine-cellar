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
  grapeVarieties: string[] | null;
  appellation: string | null;
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
    } catch {
      toast.error('Impossible d’analyser cette photo.');
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
