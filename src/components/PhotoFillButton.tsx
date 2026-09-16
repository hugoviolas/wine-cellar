'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useToast } from '@/components/Toast';
import type { PhotoExtractionResult } from './interfaces/photo-extraction-result.interface';
import { errorMessageFromResponse } from '@/lib/apiError';
import type { ReactElement } from 'react';
import { aiPhotoExtractionSchema } from '@/domain/ai/schemas';
import { readJsonBody } from '@/lib/readJsonBody';

export type { PhotoExtractionResult };

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type AcceptedMediaType = (typeof ACCEPTED_MEDIA_TYPES)[number];

const isAcceptedMediaType = (type: string): type is AcceptedMediaType => {
  return (ACCEPTED_MEDIA_TYPES as readonly string[]).includes(type);
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result: "data:image/jpeg;base64,AAAA..." — on ne garde que la
      // partie après la virgule ; la photo elle-même n'est jamais conservée
      // au-delà de cet appel (pas de persistance, voir le spec IA).
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Lecture de la photo impossible.'));
        return;
      }
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Lecture de la photo impossible.'));
    };
    reader.readAsDataURL(file);
  });
};

/**
 * `pointer: coarse` distingue un écran tactile d'une souris. Ce n'est pas
 * une détection d'appareil photo — il n'en existe pas de fiable — mais le
 * bon critère en pratique : l'attribut `capture` n'a d'effet que sur
 * mobile. Sur un ordinateur, les deux choix ouvriraient le même sélecteur
 * de fichiers, donc le bouton y va directement au sélecteur sans passer
 * par la fenêtre de choix.
 */
const COARSE_POINTER = '(pointer: coarse)';

const isCoarsePointer = (): boolean => {
  return window.matchMedia(COARSE_POINTER).matches;
};

const subscribeToPointerType = (onChange: () => void): (() => void) => {
  const query = window.matchMedia(COARSE_POINTER);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
};

export const PhotoFillButton = ({
  endpoint,
  extraBody,
  onExtracted,
}: {
  endpoint: string;
  extraBody?: Record<string, unknown>;
  onExtracted: (data: PhotoExtractionResult) => void;
}): ReactElement => {
  const toast = useToast();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // Le serveur ne sait rien de l'appareil : son instantané vaut `false`, et
  // le bouton « Prendre une photo » n'apparaît qu'à l'hydratation, sans
  // divergence entre les deux rendus. `useSyncExternalStore` plutôt qu'un
  // `useState` posé dans un effet, qui déclencherait un rendu en cascade.
  const hasCamera = useSyncExternalStore(subscribeToPointerType, isCoarsePointer, () => false);
  const [choosing, setChoosing] = useState(false);

  // Échap ferme la fenêtre, comme n'importe quelle boîte de dialogue. Le
  // listener n'est posé que lorsqu'elle est ouverte.
  useEffect(() => {
    if (!choosing) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setChoosing(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [choosing]);

  const openSource = (ref: React.RefObject<HTMLInputElement | null>): void => {
    setChoosing(false);
    ref.current?.click();
  };

  /**
   * Un seul bouton : sur mobile il ouvre le choix, ailleurs il va droit au
   * sélecteur de fichiers, seule option qui ait un sens avec une souris.
   */
  const startPicking = (): void => {
    if (hasCamera) {
      setChoosing(true);
      return;
    }
    galleryInputRef.current?.click();
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

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
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...extraBody, imageBase64, mediaType: file.type }),
      });
      if (!response.ok) {
        const message = await errorMessageFromResponse(response, 'Impossible d’analyser cette photo.');
        toast.error(message);
        return;
      }
      const extracted = aiPhotoExtractionSchema.safeParse(await readJsonBody(response));
      if (!extracted.success) {
        toast.error('Réponse illisible pour cette photo, réessaie.');
        return;
      }
      onExtracted(extracted.data);
      toast.success('Champs pré-remplis depuis la photo — vérifie-les avant d’ajouter.');
    } catch {
      toast.error('Impossible d’analyser cette photo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {/*
        Deux entrées distinctes plutôt qu'une seule, parce que le
        comportement d'un `<input type="file">` dépend de l'appareil : sans
        `capture`, certains navigateurs proposent bien le choix, d'autres
        ouvrent directement la photothèque et l'appareil photo devient
        inatteignable. Un input par intention, et c'est la fenêtre de choix
        ci-dessous qui décide lequel déclencher — le résultat ne dépend plus
        de l'interprétation du navigateur.
      */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={(...args) => void handleFile(...args)}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(...args) => void handleFile(...args)}
        className="hidden"
      />
      <button
        type="button"
        onClick={startPicking}
        disabled={busy}
        className="border border-forest text-forest rounded px-3 py-2 text-sm disabled:opacity-40"
      >
        {busy ? 'Analyse en cours…' : 'Remplir depuis une photo'}
      </button>

      {choosing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ajouter une photo"
          onClick={() => setChoosing(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
        >
          {/*
            Le clic est arrêté ici : sans ça, choisir une source
            déclencherait aussi le clic sur le fond, qui ferme la fenêtre.
          */}
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-xs rounded-lg bg-white p-4 shadow-lg"
          >
            <p className="mb-3 text-sm text-gray-500">Ajouter une photo</p>
            <button
              type="button"
              autoFocus
              onClick={() => openSource(cameraInputRef)}
              className="mb-2 w-full rounded bg-forest px-3 py-2 text-sm text-cream"
            >
              Prendre une photo
            </button>
            <button
              type="button"
              onClick={() => openSource(galleryInputRef)}
              className="mb-2 w-full rounded border border-forest px-3 py-2 text-sm text-forest"
            >
              Choisir dans la galerie
            </button>
            <button
              type="button"
              onClick={() => setChoosing(false)}
              className="w-full px-3 py-2 text-xs text-gray-500"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
