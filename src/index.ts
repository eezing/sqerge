import { readdirSync } from 'fs';
import { resolve as pathResolve } from 'node:path';
import { formatWithOptions } from 'node:util';
import { PostgresError, Sql } from 'postgres';

export default async function migrate(
  sql: Sql<{}>,
  fileDir: string,
  log?: typeof console.log
) {
  const fileList = getFileList(fileDir);
  log && log('%O file(s) found in %O', fileList.length, fileDir);
  if (fileList.length === 0) return;

  await sql.begin(async (sql) => {
    await createMigrationTable(sql);
    const migrationList = await getMigrations(sql);

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

          if (file.endsWith('sql')) {
            await sql.file(filePath);
          } else {
            await executeJsMigrationFile(sql, filePath);
          }
        } catch (error) {
          log && count > 0 && log('rollback...');

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
                  'prefix (%O) in filename is already in use',
                  prefix
                )
              );
            }

            throw new SqergeError(
              'sql_error',
              fileMessage(count, file, `(sql execution) ${error.message}`)
            );
          } else {
            throw error;
          }
        }

        log && log(fileMessage(count, file, 'executed'));
      }
    }
  });
}

export class SqergeError extends Error {
  constructor(public code: string, message: string, ...args: any) {
    super(formatWithOptions({ colors: true }, message, ...args));
  }
}

function getFileList(dir: string): { prefix: number; file: string }[] {
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

function createMigrationTable(sql: Sql<{}>) {
  return sql`
    CREATE TABLE IF NOT EXISTS sqerge_migration (
      id SERIAL NOT NULL PRIMARY KEY,
      prefix int NOT NULL UNIQUE,
      file text NOT NULL UNIQUE,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    );
  `;
}

function getMigrations(sql: Sql<{}>) {
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

function insertMigration(sql: Sql<{}>, prefix: number, file: string) {
  return sql`INSERT INTO sqerge_migration ("prefix", "file") VALUES (${prefix}, ${file});`;
}

async function executeJsMigrationFile(sql: Sql<{}>, filePath: string) {
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

function fileMessage(
  count: number,
  file: string,
  message: string,
  ...args: any
) {
  return formatWithOptions(
    { colors: true },
    `file %O (\u001b[32m${file}\u001b[39m): ${message}`,
    count,
    ...args
  );
}
