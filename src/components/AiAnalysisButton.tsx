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
      const message = typeof data?.error === 'string' ? data.error : 'Impossible de générer l\'analyse IA.';
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
      {busy ? 'Génération…' : hasAnalysis ? 'Régénérer l\'analyse IA' : 'Générer l\'analyse IA'}
    </button>
  );
}
