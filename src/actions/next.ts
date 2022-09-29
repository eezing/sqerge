import { Sql } from 'postgres';
import {
  getFileList,
  log,
  SqergeError,
  sqlCreateMigrationTable,
  sqlGetMigrationHistory,
} from '../utils';

export default async function next(sql: Sql<{}>, fileDir: string) {
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

  const nextMigrationList = fileList.slice(history.length);

  log(
    '%O new file(s) to migrate: %O',
    nextMigrationList.length,
    nextMigrationList
  );
}
