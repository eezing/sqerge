import { Sql } from 'postgres';
import { log } from '../utils';
import { sqlCreateMigrationTable, sqlGetMigrationHistory } from '../utils';

export default async function history(sql: Sql<{}>) {
  await sqlCreateMigrationTable(sql);
  const history = await sqlGetMigrationHistory(sql);

  log(
    '%O file(s) previously migrated: %O',
    history.length,
    history.map((row) => ({
      file: row.file,
      at: new Date(row.createdAt).toLocaleString(),
    }))
  );
}
