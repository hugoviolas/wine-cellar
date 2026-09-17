import 'dotenv/config';
import { db } from '../src/db/client';
import { backfillWineGeography } from '../src/domain/backfillGeography';

const format = (region: string | null, subRegion: string | null): string => {
  return [region ?? '—', subRegion ?? '—'].join(' / ');
};

const main = async (): Promise<void> => {
  const report = await backfillWineGeography({ db });

  for (const change of report.changes) {
    console.log(
      `${change.table} ${change.name} : ${format(change.from.region, change.from.subRegion)} -> ${format(
        change.to.region,
        change.to.subRegion,
      )}`,
    );
  }

  console.log(`\n${report.scanned} ligne(s) examinée(s), ${report.changes.length} recalée(s).`);
  if (report.skipped.length > 0) {
    console.log(`${report.skipped.length} ignorée(s) (détails illisibles) : ${report.skipped.join(', ')}`);
  }
  if (report.changes.length === 0) {
    console.log('Rien à faire : la géographie est déjà canonique.');
  }
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
