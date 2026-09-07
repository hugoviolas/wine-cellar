import { GARDE_STATUS_LABELS, type GardeStatus } from '@/domain/gardeStatus';

const STYLES: Record<GardeStatus, string> = {
  too_young: 'bg-blue-50 text-blue-800',
  ready: 'bg-green-50 text-green-800',
  closing_window: 'bg-amber-50 text-amber-800',
  unknown: 'bg-gray-100 text-gray-600',
};

export function GardeBadge({ status }: { status: GardeStatus }) {
  return (
    <span className={`text-xs px-3 py-1 rounded-full ${STYLES[status]}`}>
      ● {GARDE_STATUS_LABELS[status]}
    </span>
  );
}
