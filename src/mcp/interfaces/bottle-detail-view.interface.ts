import type { CellarRole } from '@/domain/access';
import type { BottleSummaryView } from './bottle-summary-view.interface';
import type { ConsumptionView } from './consumption-view.interface';

/** Fiche complète d'une bouteille (get_bottle et retour des écritures). */
export interface BottleDetailView extends BottleSummaryView {
  cellar_id: string;
  /** Rôle de l'utilisateur dans la cave de la bouteille. */
  role: CellarRole;
  classification: string | null;
  grape_varieties: string[];
  abv: number | null;
  volume_ml: number | null;
  user_note: string | null;
  analysis: string | null;
  pairings: unknown;
  tasting_advice: string | null;
  analysis_generated_at: string | null;
  added_at: string;
  consumptions?: ConsumptionView[];
}
