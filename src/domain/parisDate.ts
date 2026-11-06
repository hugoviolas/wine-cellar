/**
 * Jour calendaire à Paris, au format AAAA-MM-JJ. Une consommation saisie à
 * 0 h 30 appartient à la journée qui commence, pas à la veille comme le
 * dirait la date UTC.
 */
const PARIS_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const parisDay = (date: Date = new Date()): string => {
  return PARIS_DAY.format(date);
};

export const parisYear = (date: Date = new Date()): number => {
  return Number(parisDay(date).slice(0, 4));
};
