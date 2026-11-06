'use client';

import type { ReactElement } from 'react';

/**
 * Choix d'un nombre entre 1 et `max`, avec boutons − / + : sur téléphone,
 * un champ numérique seul ouvre le clavier pour changer un chiffre.
 */
export const QuantityStepper = ({
  value,
  max,
  onChange,
  label,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
}): ReactElement => {
  const buttonClass =
    'w-9 h-9 border border-gray-300 rounded text-base leading-none disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <div className="flex items-center gap-1.5 text-sm text-gray-600">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label="Une bouteille de moins"
        className={buttonClass}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        value={Number.isNaN(value) ? '' : value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="border border-gray-300 rounded h-9 w-14 text-center"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Une bouteille de plus"
        className={buttonClass}
      >
        +
      </button>
      <span className="whitespace-nowrap">sur {max}</span>
    </div>
  );
};
