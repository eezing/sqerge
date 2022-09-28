import { resolve as pathResolve } from 'node:path';
import { PostgresError, Sql } from 'postgres';
import {
  getFileList,
  loadSqlFromJsFile,
  log,
  SqergeError,
  sqlCreateMigrationTable,
  sqlGetMigrationHistory,
} from '../utils';

export default async function migrate(sql: Sql<{}>, fileDir: string) {
  const fileList = getFileList(fileDir);
  log('%O file(s) found in %O', fileList.length, fileDir);

  await sqlCreateMigrationTable(sql);

  const history = await sqlGetMigrationHistory(sql);
  log('%O file(s) previously migrated', history.length);

  const isConsistent = history.every(
    (row, index) => row.file === fileList[index]
  );

  if (isConsistent === false) {
    throw new SqergeError(
      'inconsistent_files',
      'files inconsistent with migration history'
    );
  }

  const nextMigrationList = fileList
    .slice(history.length)
    .map((file, index) => ({ file, index }));

  log('%O new files to migrate', nextMigrationList.length);

  if (nextMigrationList.length) {
    log('running migration...');
    await sql.begin(async (sql) => {
      for (const item of nextMigrationList) {
        try {
          log('%O.', item.index + 1, item.file);
          const filePath = pathResolve(fileDir, item.file);

          if (item.file.endsWith('.sql')) {
            await sql.file(filePath);
          } else if (item.file.endsWith('.js')) {
            await sql`${sql.unsafe(loadSqlFromJsFile(filePath))}`;
          }

          await sql`INSERT INTO sqerge_migration ("file") VALUES (${item.file})`;
        } catch (error) {
          if (error instanceof PostgresError) {
            throw new SqergeError(
              'migration_file_query_error',
              '(migration reverted on query error) %s: %s',
              item.file,
              error.message
            );
          }
        }
      }
    });
  }

  log('done!');
}
