import { Fragment } from 'react';
import { factValue } from '@/lib/stringArray';
import type { Fact } from './interfaces/fact.interface';
import type { ReactElement } from 'react';

/**
 * Caractéristiques d'une fiche, en liste de définitions : libellé discret à
 * gauche, valeur à droite.
 *
 * Remplace la ligne à points médians sur les fiches, où elle mettait sur le
 * même plan des informations de natures différentes (une date, une
 * géographie, une taxonomie) sans dire laquelle était laquelle — « Rhône ·
 * Rhône septentrional » ne disait pas quel terme était la région.
 *
 * Les entrées sans valeur sont omises : une bière n'affiche ni appellation
 * ni cépages plutôt que des tirets alignés.
 */
export const FactList = ({ facts }: { facts: readonly Fact[] }): ReactElement | null => {
  const filled = facts
    .map((fact) => ({ label: fact.label, value: factValue(fact.value) }))
    .filter((fact): fact is { label: string; value: string } => fact.value !== null);

  if (filled.length === 0) {
    return null;
  }

  return (
    <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
      {filled.map((fact) => (
        <Fragment key={fact.label}>
          <dt className="text-xs uppercase tracking-wide text-gray-500 pt-0.5">{fact.label}</dt>
          <dd>{fact.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
};
