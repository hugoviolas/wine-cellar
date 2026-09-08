'use client';

import { useState } from 'react';
import { WINE_REGIONS } from '@/lib/wineRegions';

const OTHER_VALUE = '__autre__';

/**
 * Select de régions courantes + case "Autre" révélant un champ libre. La
 * valeur externe reste une simple chaîne (comme avant) — ce composant ne
 * fait que proposer une saisie guidée par-dessus. Si la valeur reçue (ex.
 * écrite par l'IA, ou une ancienne saisie libre) ne correspond à aucune
 * région connue, "Autre" est sélectionné automatiquement et le champ libre
 * est pré-rempli avec cette valeur — rien n'est jamais masqué ou perdu.
 * `forceCustom` couvre le cas où l'utilisateur vient de choisir "Autre"
 * alors que la valeur est encore vide (donc "connue" au sens strict).
 */
export function RegionInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const matchesKnown = value === '' || (WINE_REGIONS as readonly string[]).includes(value);
  const [forceCustom, setForceCustom] = useState(false);
  const showCustom = forceCustom || !matchesKnown;

  function handleSelectChange(selected: string) {
    if (selected === OTHER_VALUE) {
      setForceCustom(true);
      onChange('');
    } else {
      setForceCustom(false);
      onChange(selected);
    }
  }

  return (
    <div>
      <label className="block text-xs uppercase tracking-wide mb-1">Région</label>
      <select
        value={showCustom ? OTHER_VALUE : value}
        onChange={(e) => handleSelectChange(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
      >
        <option value="">—</option>
        {WINE_REGIONS.map((region) => (
          <option key={region} value={region}>{region}</option>
        ))}
        <option value={OTHER_VALUE}>Autre (préciser)</option>
      </select>
      {showCustom && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Préciser la région"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm mt-2"
        />
      )}
    </div>
  );
}
