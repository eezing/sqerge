import { readdirSync, readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { PostgresError, Sql } from 'postgres';
import { SqergeError } from './utils';
import { resolve as pathResolve } from 'node:path';

export default class Sqerge {
  private sql: Sql<{}>;
  private log: typeof console.log;

  constructor(input: { sql: Sqerge['sql']; log?: Sqerge['log'] }) {
    this.sql = input.sql;
    this.log = input.log || (() => {});
  }

  private readonly filePattern = /^\d+-.*[.](sql|js)$/;

  async migrate(fileDir: string) {
    const fileList = this.getFileList(fileDir);
    this.log('%O file(s) found in %O', fileList.length, fileDir);

    await this.createMigrationTable();

    const history = await this.getMigrationHistory();
    this.log('%O file(s) previously migrated', history.length);

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

    this.log('%O new files to migrate', nextMigrationList.length);

    if (nextMigrationList.length) {
      this.log('running migration...');
      await this.sql.begin(async (sql) => {
        for (const item of nextMigrationList) {
          try {
            this.log('%O.', item.index + 1, item.file);
            const filePath = pathResolve(fileDir, item.file);

            if (item.file.endsWith('.sql')) {
              await sql.file(filePath);
            } else if (item.file.endsWith('.js')) {
              await sql`${sql.unsafe(this.loadSqlFromJsFile(filePath))}`;
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

    this.log('done!');
  }

  getFileList(fileDir: string): string[] {
    try {
      const parsePrefix = (file: string) => parseInt(file.split('-')[0]);

      return readdirSync(fileDir)
        .filter((file) => this.filePattern.test(file))
        .sort((a, b) => parsePrefix(a) - parsePrefix(b));
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        throw new SqergeError(
          'dir_not_found',
          'directory not found: %O',
          fileDir
        );
      }

      throw error;
    }
  }

  getMigrationHistory() {
    return this.sql<{ id: string; file: string; createdAt: string }[]>`
      SELECT * FROM sqerge_migration ORDER BY "id";
    `;
  }

  async createMigrationTable() {
    await this.sql`
      CREATE TABLE IF NOT EXISTS sqerge_migration (
        id SERIAL NOT NULL PRIMARY KEY,
        file text NOT NULL UNIQUE,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `;
  }

  loadSqlFromJsFile(path: string) {
    const vm = new Script(readFileSync(path).toString());
    const ctx: { sql?: string } = {};
    vm.runInNewContext(ctx);

    if (!ctx.sql) {
      throw new SqergeError(
        'js_file_invalid',
        'the %O global variable is %O in file %O',
        undefined,
        path
      );
    }

    return ctx.sql;
  }
}
