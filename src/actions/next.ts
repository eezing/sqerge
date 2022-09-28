import { Sql } from 'postgres';
import {
  getFileList,
  log,
  sqlCreateMigrationTable,
  sqlGetMigrationHistory,
} from '../utils';

export default async function next(sql: Sql<{}>, fileDir: string) {
  const fileList = getFileList(fileDir);
  log('%O file(s) found in %O', fileList.length, fileDir);

  await sqlCreateMigrationTable(sql);
  const history = await sqlGetMigrationHistory(sql);
  log('%O file(s) previously migrated', history.length);

  const next = fileList.slice(history.length);
  log('%O new files to migrate: %O', next.length, next);
}
