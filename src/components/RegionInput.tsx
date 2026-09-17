'use client';

import { useState } from 'react';
import { WINE_REGIONS, subRegionsForRegion } from '@/domain/wineGeography';
import type { RegionInputProps } from './interfaces/region-input-props.interface';
import type { ReactElement } from 'react';

const OTHER_VALUE = '__autre__';

/**
 * Région + sous-région. Deux selects liés : les sous-régions proposées
 * dépendent de la région choisie, et une région sans découpage connu
 * (Provence, Jura...) n'affiche pas le second select.
 *
 * Les deux valeurs restent de simples chaînes. Si celle reçue ne correspond
 * à aucune entrée connue (écrite par l'IA, saisie libre, vin étranger),
 * « Autre » est sélectionné et le champ libre est pré-rempli avec cette
 * valeur — rien n'est jamais masqué ni perdu. `forceCustom` couvre le cas où
 * l'utilisateur vient de choisir « Autre » alors que la valeur est encore
 * vide, donc « connue » au sens strict.
 */
export const RegionInput = ({
  value,
  subRegion,
  onChange,
  onSubRegionChange,
}: RegionInputProps): ReactElement => {
  const matchesKnown = value === '' || (WINE_REGIONS as readonly string[]).includes(value);
  const [forceCustom, setForceCustom] = useState(false);
  const showCustom = forceCustom || !matchesKnown;

  const knownSubRegions = subRegionsForRegion(value);
  const subRegionMatchesKnown = subRegion === '' || knownSubRegions.includes(subRegion);
  const [forceCustomSubRegion, setForceCustomSubRegion] = useState(false);
  const showCustomSubRegion = forceCustomSubRegion || !subRegionMatchesKnown;

  const handleSelectChange = (selected: string): void => {
    if (selected === OTHER_VALUE) {
      setForceCustom(true);
      onChange('');
    } else {
      setForceCustom(false);
      onChange(selected);
    }
    // Changer de région invalide la sous-région : « Haut-Médoc » n'a aucun
    // sens sous « Bourgogne ». On repart de zéro plutôt que de laisser une
    // combinaison incohérente que le résolveur devrait ensuite défaire.
    setForceCustomSubRegion(false);
    onSubRegionChange('');
  };

  const handleSubRegionSelectChange = (selected: string): void => {
    if (selected === OTHER_VALUE) {
      setForceCustomSubRegion(true);
      onSubRegionChange('');
    } else {
      setForceCustomSubRegion(false);
      onSubRegionChange(selected);
    }
  };

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Région</label>
        <select
          value={showCustom ? OTHER_VALUE : value}
          onChange={(e) => handleSelectChange(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        >
          <option value="">—</option>
          {WINE_REGIONS.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
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

      {(knownSubRegions.length > 0 || showCustomSubRegion) && (
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Sous-région</label>
          <select
            value={showCustomSubRegion ? OTHER_VALUE : subRegion}
            onChange={(e) => handleSubRegionSelectChange(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {knownSubRegions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            <option value={OTHER_VALUE}>Autre (préciser)</option>
          </select>
          {showCustomSubRegion && (
            <input
              value={subRegion}
              onChange={(e) => onSubRegionChange(e.target.value)}
              placeholder="Préciser la sous-région"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm mt-2"
            />
          )}
        </div>
      )}
    </div>
  );
};
