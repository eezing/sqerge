import colors from 'colors/safe';
import { readdirSync } from 'fs';
import { formatWithOptions } from 'node:util';
import { PostgresError, Sql } from 'postgres';

export function isNodeError<T extends new (...args: any) => Error>(
  value: unknown,
  errorType: T
): value is InstanceType<T> & NodeJS.ErrnoException {
  return value instanceof errorType;
}

export class SqergeError extends Error {
  constructor(public code: string, message: string, ...args: any) {
    super(formatWithOptions({ colors: true }, message, ...args));
  }
}

export const log = (message: string, ...args: any) =>
  console.log(
    `${colors.magenta('[')}${colors.cyan('sqerge')}${colors.magenta(
      ']'
    )} ${message}`,
    ...args
  );

export function groupByFirstMatch(
  items: string[],
  pattern: RegExp
): [string, string[]][] {
  const map = new Map<string, string[]>();

  for (const item of items) {
    const check = pattern.exec(item);

    if (check) {
      const match = check[1];
      const matchList = map.get(match);

      if (matchList) {
        matchList.push(item);
      } else {
        map.set(match, [item]);
      }
    }
  }

  return Array.from(map.entries());
}

export function getFileList(dir: string): string[] {
  const filePattern = /^(\d+)-.*[.](sql|js)$/;

  try {
    const parsePrefix = (file: string) => parseInt(file.split('-')[0]);

    const fileList = readdirSync(dir)
      .filter((file) => filePattern.test(file))
      .sort((a, b) => parsePrefix(a) - parsePrefix(b));

    const duplicatePrefixes = groupByFirstMatch(fileList, filePattern).filter(
      (g) => g[1].length > 1
    );

    if (duplicatePrefixes.length) {
      throw new SqergeError(
        'duplicate_file_prefix',
        'found files with duplicate prefix',
        duplicatePrefixes
      );
    }

    return fileList;
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw new SqergeError('dir_not_found', 'directory not found', dir);
    }

    throw error;
  }
}

export function sqlCreateMigrationTable(sql: Sql<{}>) {
  return sql`
    CREATE TABLE IF NOT EXISTS sqerge_migration (
      id SERIAL NOT NULL PRIMARY KEY,
      file text NOT NULL UNIQUE,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    );
  `;
}

export function sqlInsertMigration(sql: Sql<{}>, file: string) {
  return sql`INSERT INTO sqerge_migration ("file") VALUES (${file});`;
}

export function sqlGetMigrationHistory(sql: Sql<{}>) {
  return sql<{ id: string; file: string; createdAt: string }[]>`
    SELECT * FROM sqerge_migration ORDER BY "id";
  `;
}

export async function executeJsMigrationFile(sql: Sql<{}>, filePath: string) {
  const module = await import(filePath);

  if (typeof module.default === 'string') {
    await sql`${sql.unsafe(module.default)}`;
  } else if (typeof module.default === 'function') {
    await module.default(sql);
  } else {
    throw new SqergeError(
      'invalid_js_migration_file',
      '%O default export must be a string or function',
      filePath
    );
  }
}

export async function withSqergeErrorHandler(callback: () => Promise<void>) {
  try {
    await callback();
  } catch (error) {
    if (error instanceof SqergeError) {
      log(`${colors.bold(colors.red('(error)'))} ${error.message}`);
      process.exit(1);
    } else if (error instanceof PostgresError) {
      log(`${colors.bold(colors.red('(database error)'))} ${error.message}`);
      process.exit(1);
    } else if (isNodeError(error, Error)) {
      if (error.code === 'ECONNREFUSED') {
        log(
          `${colors.bold(
            colors.red('(database error)')
          )} connection refused at %O`,
          error.message.split('ECONNREFUSED ')[1]
        );
        process.exit(1);
      } else if (error.code === 'ENOTFOUND') {
        log(
          `${colors.bold(colors.red('(database error)'))} host not found at %O`,
          error.message.split('ENOTFOUND ')[1]
        );
        process.exit(1);
      }
    }

    throw error;
  }
}
