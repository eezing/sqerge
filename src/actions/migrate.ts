import { resolve as pathResolve } from 'node:path';
import { PostgresError, Sql } from 'postgres';
import {
  executeJsMigrationFile,
  getFileList,
  log,
  SqergeError,
  sqlCreateMigrationTable,
  sqlGetMigrationHistory,
  sqlInsertMigration,
} from '../utils';

export default async function migrate(
  sql: Sql<{}>,
  fileDir: string,
  flags: string[] = []
) {
  const fileList = getFileList(fileDir);
  log('%O file(s) found in %O', fileList.length, fileDir);

  await sqlCreateMigrationTable(sql);
  const history = await sqlGetMigrationHistory(sql);
  log('%O file(s) previously migrated', history.length);

  if (!history.every((row, index) => row.file === fileList[index])) {
    throw new SqergeError(
      'inconsistent_files',
      'file(s) inconsistent with migration history'
    );
  }

  if (
    !history.every(
      (row) => row.flags?.every((flag) => flags.includes(flag)) ?? true
    )
  ) {
    throw new SqergeError(
      'missing_flags',
      'previously used flag(s) are missing'
    );
  }

  const nextMigrationList = fileList
    .slice(history.length)
    .map((file, index) => ({ file, index }));

  log('%O new file(s) to migrate', nextMigrationList.length);

  if (nextMigrationList.length) {
    log('running migration...');
    await sql.begin(async (sql) => {
      for (const item of nextMigrationList) {
        try {
          log('%O.', item.index + 1, item.file);
          const filePath = pathResolve(fileDir, item.file);

          if (item.file.endsWith('.sql')) {
            await sql.file(filePath);
            await sqlInsertMigration(sql, item.file);
          } else if (item.file.endsWith('.js')) {
            await executeJsMigrationFile(sql, filePath, flags);
            await sqlInsertMigration(sql, item.file, flags);
          }
        } catch (error) {
          if (error instanceof PostgresError) {
            throw new SqergeError(
              'migration_file_query_error',
              '(migration reverted on query error) %s: %s',
              item.file,
              error.message
            );
          } else {
            throw error;
          }
        }
      }
    });
  }

  log('done!');
}
