'use client';

import { useState } from 'react';
import {
  AROMA_FAMILIES,
  HUE_SWATCHES,
  TASTING_STEPS,
  WINE_SHADES,
  criteriaForShade,
  criterionLabel,
  orderedFill,
  type TastingCriterion,
  type WineShade,
} from '@/domain/tasting';
import type { ReactElement } from 'react';

/** Un pictogramme par étape, dans l'ordre où on les traverse. */
const STEP_ICONS: Record<string, ReactElement> = {
  regarder: (
    <>
      <path d="M1.8 12S5.6 5.5 12 5.5 22.2 12 22.2 12 18.4 18.5 12 18.5 1.8 12 1.8 12Z" />
      <circle cx="12" cy="12" r="3.1" />
    </>
  ),
  sentir: (
    <>
      <path d="M6 19.5c0-3 2.7-3 2.7-6s-2.7-3-2.7-6" />
      <path d="M11.6 20.5c0-3.4 3.1-3.4 3.1-6.8s-3.1-3.4-3.1-6.8" />
      <path d="M17.6 18.5c0-2.6 2.4-2.6 2.4-5.2s-2.4-2.6-2.4-5.2" />
    </>
  ),
  gouter: (
    <>
      <path d="M2.6 11.2C5 9 8.4 7.8 12 7.8s7 1.2 9.4 3.4c-2.4 3.3-5.7 5-9.4 5s-7-1.7-9.4-5Z" />
      <path d="M2.6 11.2h18.8" />
    </>
  ),
  conclusion: (
    <>
      <path d="M4 20.2l.9-4 11-11 3.1 3.1-11 11-4 .9Z" />
      <path d="M14.3 5.9 17.4 9" />
    </>
  ),
};

const StepIcon = ({ stepKey }: { stepKey: string }): ReactElement => (
  <svg
    viewBox="0 0 24 24"
    className="w-5 h-5 shrink-0 text-gold"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {STEP_ICONS[stepKey]}
  </svg>
);

const Criterion = ({
  criterion,
  shade,
}: {
  criterion: TastingCriterion;
  shade: WineShade | null;
}): ReactElement => {
  return (
    <div className="py-2.5 border-t border-gray-100 first:border-t-0">
      <span className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1.5">
        {criterionLabel({ criterion, shade })}
      </span>
      <CriterionValues criterion={criterion} />
    </div>
  );
};

const CriterionValues = ({ criterion }: { criterion: TastingCriterion }): ReactElement => {
  if (criterion.hues) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {criterion.values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1.5 text-sm border border-gray-200 rounded-full pl-1 pr-2.5 py-0.5"
          >
            <i
              className="w-4 h-4 rounded-full shrink-0 border border-black/15"
              style={{ backgroundColor: HUE_SWATCHES[value] }}
            />
            {value}
          </span>
        ))}
      </div>
    );
  }

  // Une échelle se distingue d'une liste par sa seule teinte, qui monte avec
  // la valeur. Une graduation ou un axe auraient la forme d'un contrôle,
  // dans une page qui ne se manipule pas.
  if (criterion.ordered) {
    return (
      <div className="flex flex-wrap gap-1">
        {criterion.values.map((value, index) => (
          <span
            key={value}
            className="text-[13px] rounded-full px-2.5 py-0.5"
            style={{ backgroundColor: orderedFill({ index, count: criterion.values.length }) }}
          >
            {value}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {criterion.values.map((value) => (
        <span key={value} className="text-sm border border-gray-200 rounded-full px-2.5 py-0.5">
          {value}
        </span>
      ))}
    </div>
  );
};

const shadeButtonClass = (active: boolean): string => {
  const base = 'text-xs rounded-full px-3 py-1.5 border inline-flex items-center gap-1.5';
  return active ? `${base} bg-forest border-forest text-cream` : `${base} border-gray-300 text-forest`;
};

export const TastingMemo = (): ReactElement => {
  const [shade, setShade] = useState<WineShade | null>(null);
  // L'accordéon s'ouvre sur « Regarder » : c'est par là qu'on commence, et
  // une page entièrement repliée ne montrerait rien de ce qu'elle contient.
  const [openKeys, setOpenKeys] = useState<readonly string[]>([TASTING_STEPS[0]?.key ?? '']);

  const toggleStep = ({ key, open }: { key: string; open: boolean }): void => {
    setOpenKeys((current) => {
      if (open) {
        return current.includes(key) ? current : [...current, key];
      }
      return current.filter((other) => other !== key);
    });
  };

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          type="button"
          onClick={() => setShade(null)}
          aria-pressed={shade === null}
          className={shadeButtonClass(shade === null)}
        >
          Tous
        </button>
        {WINE_SHADES.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setShade(option.key)}
            aria-pressed={shade === option.key}
            className={shadeButtonClass(shade === option.key)}
          >
            <i
              className="w-2.5 h-2.5 rounded-full inline-block border border-black/15"
              style={{ backgroundColor: option.dot }}
            />
            {option.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded overflow-hidden">
        {TASTING_STEPS.map((step) => {
          const criteria = criteriaForShade({ step, shade });
          return (
            <details
              key={step.key}
              open={openKeys.includes(step.key)}
              onToggle={(event) => toggleStep({ key: step.key, open: event.currentTarget.open })}
              className="border-t border-gray-100 first:border-t-0 group"
            >
              <summary className="flex items-center gap-2.5 px-3.5 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <StepIcon stepKey={step.key} />
                <h3 className="text-lg flex-1">{step.label}</h3>
                <span className="text-[11px] text-gray-500">
                  {criteria.length} critère{criteria.length > 1 ? 's' : ''}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  className="w-3.5 h-3.5 text-gray-400 transition-transform group-open:rotate-90 motion-reduce:transition-none"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </summary>
              <div className="px-3.5 pb-3">
                {criteria.map((criterion) => (
                  <Criterion
                    key={`${criterion.label}-${criterion.shade ?? 'tous'}`}
                    criterion={criterion}
                    shade={shade}
                  />
                ))}
              </div>
            </details>
          );
        })}
      </div>

      <h3 className="mt-6 mb-2">
        <span className="text-[11px] uppercase tracking-wide text-gray-500 not-italic font-sans">
          Quelques exemples d&apos;arômes
        </span>
      </h3>
      {shade ? <AromaList shade={shade} /> : <AromaTable />}
    </div>
  );
};

/**
 * Une couleur choisie : une seule liste, par famille. Le tableau à trois
 * colonnes ne tient pas dans la largeur d'un téléphone — ici il n'a plus
 * lieu d'être, et le glissement latéral disparaît avec lui.
 */
const AromaList = ({ shade }: { shade: WineShade }): ReactElement => {
  const option = WINE_SHADES.find((item) => item.key === shade);

  return (
    <>
      <div className="bg-white rounded px-3.5 py-1">
        {AROMA_FAMILIES.map((family) => {
          const examples = family.examples[shade];
          return (
            <div key={family.family} className="py-2.5 border-t border-gray-100 first:border-t-0">
              <span className="block text-[11px] uppercase tracking-wide text-[#7a2331] mb-0.5">
                {family.family}
              </span>
              <p className={examples ? 'text-sm' : 'text-sm text-gray-400 italic'}>
                {examples ?? 'Aucun exemple pour cette couleur'}
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Arômes des {option?.plural.toLowerCase()}. Reviens sur « Tous » pour comparer les trois.
      </p>
    </>
  );
};

const AromaTable = (): ReactElement => {
  return (
    <>
      <div className="bg-white rounded overflow-x-auto">
        <table className="border-collapse text-[13px] min-w-[34rem]">
          <thead>
            <tr>
              <th
                scope="col"
                className="text-left align-top px-3 py-2.5 text-[11px] uppercase tracking-wide font-normal text-gray-500 whitespace-nowrap"
              >
                Arômes
              </th>
              {WINE_SHADES.map((option) => (
                <th
                  key={option.key}
                  scope="col"
                  className="text-left align-top px-3 py-2.5 text-[11px] uppercase tracking-wide font-normal text-gray-500 whitespace-nowrap"
                >
                  <i
                    className="w-2.5 h-2.5 rounded-full inline-block mr-1.5 border border-black/15"
                    style={{ backgroundColor: option.dot }}
                  />
                  {option.plural}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AROMA_FAMILIES.map((family) => (
              <tr key={family.family}>
                <th
                  scope="row"
                  className="text-left align-top px-3 py-2.5 border-t border-gray-100 text-[11px] uppercase tracking-wide font-normal text-[#7a2331] whitespace-nowrap"
                >
                  {family.family}
                </th>
                {WINE_SHADES.map((option) => {
                  const examples = family.examples[option.key];
                  return (
                    <td
                      key={option.key}
                      className={`align-top px-3 py-2.5 border-t border-gray-100 ${examples ? '' : 'text-gray-400'}`}
                    >
                      {examples ?? '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Les trois couleurs côte à côte : le tableau se fait glisser du doigt. Choisis une couleur au-dessus
        pour n&apos;en garder qu&apos;une.
      </p>
    </>
  );
};
