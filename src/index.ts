import { readdirSync } from 'fs';
import { resolve as pathResolve } from 'node:path';
import { PostgresError, Sql } from 'postgres';
import { fileMessage, SqergeError } from './utils';

export default async function migrate(
  sql: Sql<{}>,
  fileDir: string,
  log?: typeof console.log
) {
  const fileList = getFileList(fileDir);
  log && log('%O file(s) found in %O', fileList.length, fileDir);

  await createMigrationTable(sql);
  const migrationList = await getMigrations(sql);

  await sql.begin(async (sql) => {
    for (let i = 0; i < fileList.length; i++) {
      const count = i + 1;
      const { prefix, file } = fileList[i];

      if (i < migrationList.length) {
        const row = migrationList[i];

        if (file !== row.file) {
          throw new SqergeError(
            'filename_mismatch',
            fileMessage(
              count,
              file,
              'filename does not match %O in migration history',
              row.file
            )
          );
        }

        log && log(fileMessage(count, file, 'already migrated'));
      } else {
        const filePath = pathResolve(fileDir, file);

        try {
          await insertMigration(sql, prefix, file);
        } catch (error) {
          if (error instanceof PostgresError) {
            if (
              error.code === '23505' &&
              error.constraint_name === 'sqerge_migration_prefix_key'
            ) {
              throw new SqergeError(
                'duplicate_prefix',
                fileMessage(
                  count,
                  file,
                  'prefix %O in filename is already in use',
                  prefix
                )
              );
            }
          }
        }

        if (file.endsWith('sql')) {
          await sql.file(filePath);
        } else {
          await executeJsMigrationFile(sql, filePath);
        }

        log && log(fileMessage(count, file, 'migrated'));
      }
    }
  });
}

export function getFileList(dir: string): { prefix: number; file: string }[] {
  const filePattern = /^(\d+)-.*[.](sql|js)$/;

  try {
    return readdirSync(dir)
      .filter((file) => filePattern.test(file))
      .map((file) => ({ prefix: parseInt(file.split('-')[0]), file }))
      .sort((a, b) => a.prefix - b.prefix);
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw new SqergeError('dir_not_found', 'directory not found: %O', dir);
    }

    throw error;
  }
}

export function createMigrationTable(sql: Sql<{}>) {
  return sql`
    CREATE TABLE IF NOT EXISTS sqerge_migration (
      id SERIAL NOT NULL PRIMARY KEY,
      prefix int NOT NULL UNIQUE,
      file text NOT NULL UNIQUE,
      flags text[],
      "createdAt" timestamptz NOT NULL DEFAULT now()
    );
  `;
}

export function getMigrations(sql: Sql<{}>) {
  return sql<
    {
      id: string;
      prefix: number;
      file: string;
      createdAt: string;
    }[]
  >`
    SELECT * FROM sqerge_migration ORDER BY "id";
  `;
}

export function insertMigration(sql: Sql<{}>, prefix: number, file: string) {
  return sql`INSERT INTO sqerge_migration ("prefix", "file") VALUES (${prefix}, ${file});`;
}

export async function executeJsMigrationFile(sql: Sql<{}>, filePath: string) {
  const module = await import(filePath);

  if (typeof module.default === 'function') {
    await module.default(sql);
  } else {
    throw new SqergeError(
      'invalid_js_migration_file',
      'file %O default export must be a function',
      filePath
    );
  }
}
