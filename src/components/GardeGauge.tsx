export function GardeGauge({
  progress,
  vintage,
  drinkFrom,
  drinkUntil,
}: {
  progress: number;
  vintage: number | null;
  drinkFrom: number | null;
  drinkUntil: number | null;
}) {
  if (drinkFrom == null || drinkUntil == null) return null;

  return (
    <div>
      <div className="bg-gray-200 h-1.5 rounded-full relative">
        <div
          className="absolute left-0 top-0 bottom-0 rounded-full bg-gradient-to-r from-gold to-sage"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
        <span>{vintage}</span>
        <span>Apogée {drinkFrom}–{drinkUntil}</span>
      </div>
    </div>
  );
}
