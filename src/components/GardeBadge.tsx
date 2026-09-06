import type { GardeStatus } from '@/domain/gardeStatus';

const LABELS: Record<GardeStatus, string> = {
  too_young: 'Trop jeune',
  ready: 'À boire maintenant',
  closing_window: 'À surveiller, fin de fenêtre',
  unknown: 'Fenêtre de garde inconnue',
};

const STYLES: Record<GardeStatus, string> = {
  too_young: 'bg-blue-50 text-blue-800',
  ready: 'bg-green-50 text-green-800',
  closing_window: 'bg-amber-50 text-amber-800',
  unknown: 'bg-gray-100 text-gray-600',
};

export function GardeBadge({ status }: { status: GardeStatus }) {
  return (
    <span className={`text-xs px-3 py-1 rounded-full ${STYLES[status]}`}>
      ● {LABELS[status]}
    </span>
  );
}
