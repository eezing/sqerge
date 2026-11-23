import { readdirSync } from 'fs';
import { resolve as pathResolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { formatWithOptions } from 'node:util';
import postgres, { PostgresError, Sql } from 'postgres';

type MigrationFile = { prefix: number; file: string; noTransaction: boolean };

// Advisory lock key: "sqerge" in ASCII.
const LOCK_KEY = 0x737165726765;

export default async function migrate(
  sql: Sql,
  fileDir: string,
  options?: { role?: string; log?: typeof console.log },
) {
  const log = options?.log;

  const fileList = getFileList(fileDir);
  log && log('%O file(s) found in %O', fileList.length, fileDir);
  if (fileList.length === 0) return;

  if (!sql.options) {
    throw new SqergeError(
      'invalid_sql',
      'sql must be an instance from postgres(), not a transaction or reserved connection',
    );
  }

  // The caller may have SET these on its connection, rather than passing them
  // as options, so the migration should still run with them.
  const settings = await getSessionSettings(sql);

  // Run the migration on a connection of its own, so the lock and role last
  // for the whole run, and the caller's connections stay as they are.
  let closed = false;
  const db = postgres({
    // postgres() accepts the parsed options of another instance.
    ...(sql.options as unknown as postgres.Options<{}>),
    max: 1,
    idle_timeout: undefined,
    max_lifetime: null,
    // If the connection closes, end, so that later queries fail instead of
    // reconnecting without the lock and role. Without a timeout, end() waits
    // forever for a query that was running when the connection closed.
    onclose: () => {
      closed = true;
      void db.end({ timeout: 0 });
    },
  });

  const transaction = (fn: (sql: Sql) => Promise<number>) =>
    // TypeScript workaround for https://github.com/porsager/postgres/issues/1143
    db.begin((trx) => fn(trx as unknown as Sql));

  // Executes files from index `start` up to the next no-transaction file, and
  // returns the index of the file where it stopped.
  const executeFiles = async (sql: Sql, start: number) => {
    let i = start;

    for (; i < fileList.length && !fileList[i].noTransaction; i++) {
      await executeFile(sql, fileDir, fileList[i], i + 1, log);
    }

    return i;
  };

  try {
    await lock(db, log);

    if (typeof options?.role === 'string') {
      settings.push(['role', options.role]);
    }

    for (const [name, value] of settings) {
      await db`SELECT set_config(${name}, ${value}, false);`;
    }

    let next = await transaction(async (sql) => {
      await createMigrationTable(sql);
      await widenPrefixColumn(sql, fileList);
      const migrationList = await getMigrations(sql);

      for (let i = 0; i < fileList.length && i < migrationList.length; i++) {
        const { file } = fileList[i];

        if (file !== migrationList[i]) {
          throw new SqergeError(
            'filename_mismatch',
            fileMessage(
              i + 1,
              file,
              'filename does not match %O in migration history',
              migrationList[i],
            ),
          );
        }

        log && log(fileMessage(i + 1, file, 'already migrated'));
      }

      return executeFiles(sql, migrationList.length);
    });

    // A no-transaction file runs after the files before it are committed, and
    // the files after it run in a new transaction.
    while (next < fileList.length) {
      const start = next;

      if (!fileList[start].noTransaction) {
        next = await transaction((sql) => executeFiles(sql, start));
        continue;
      }

      const { prefix, file } = fileList[start];

      // A no-transaction file is recorded after it runs, so check for a
      // duplicate prefix first. The previous file is recorded already.
      if (start > 0 && fileList[start - 1].prefix === prefix) {
        throw duplicatePrefixError(start + 1, file, prefix);
      }

      await executeFile(db, fileDir, fileList[start], start + 1, log);
      next++;
    }
  } finally {
    // Once the connection closed, it's ending already. Waiting for that lets
    // postgres.js write to the dead socket and crash, e.g. with the ROLLBACK
    // that begin() sends.
    if (!closed) await db.end();
  }
}

export class SqergeError extends Error {
  constructor(
    public code: string,
    message: string,
    ...args: any
  ) {
    super(formatWithOptions({ colors: true }, message, ...args));
  }
}

function getFileList(dir: string): MigrationFile[] {
  const filePattern = /^(\d+)-.*[.](sql|js|mjs)$/;

  try {
    const fileList = readdirSync(dir)
      .filter((file) => filePattern.test(file))
      .map((file) => ({
        prefix: parseInt(file.split('-')[0]),
        file,
        noTransaction: /[.]no-transaction[.](sql|js|mjs)$/.test(file),
      }))
      .sort((a, b) => a.prefix - b.prefix);

    // Larger prefixes lose precision as JavaScript numbers.
    const i = fileList.findIndex(({ prefix }) => !Number.isSafeInteger(prefix));

    if (i >= 0) {
      throw new SqergeError(
        'prefix_out_of_range',
        fileMessage(
          i + 1,
          fileList[i].file,
          'prefix in filename is larger than %O',
          Number.MAX_SAFE_INTEGER,
        ),
      );
    }

    return fileList;
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw new SqergeError('dir_not_found', 'directory not found: %O', dir);
    }

    throw error;
  }
}

// sqerge reads its own queries with values() and as text, so that the caller's
// transform and type options, which postgres() passes on, can't change them.

// Returns [name, value] pairs of the settings changed with SET in the session.
async function getSessionSettings(sql: Sql): Promise<string[][]> {
  return sql`
    SELECT name, setting FROM pg_settings WHERE source = 'session'
    UNION ALL
    SELECT 'role', current_setting('role') WHERE current_setting('role') <> 'none';
  `.values();
}

// Waits for other sqerge runs on the database to finish. It polls, because a
// session waiting in pg_advisory_lock() holds a snapshot, which would block
// CREATE INDEX CONCURRENTLY in the run that has the lock.
async function lock(sql: Sql, log?: typeof console.log) {
  for (let attempt = 0; ; attempt++) {
    const [[locked]] =
      await sql`SELECT pg_try_advisory_lock(${LOCK_KEY})::text;`.values();

    if (locked === 'true') return;
    if (attempt === 0) log && log('waiting for another migration to finish...');
    await sleep(1000);
  }
}

function createMigrationTable(sql: Sql) {
  return sql`
    CREATE TABLE IF NOT EXISTS sqerge_migration (
      id SERIAL NOT NULL PRIMARY KEY,
      prefix bigint NOT NULL UNIQUE,
      file text NOT NULL UNIQUE,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    );
  `;
}

// Before 3.3, sqerge stored the prefix as an int. Widen the column only when a
// prefix needs it, since that takes owning the table.
async function widenPrefixColumn(sql: Sql, fileList: MigrationFile[]) {
  if (fileList.every(({ prefix }) => prefix <= 2147483647)) return;

  const [[type]] = await sql`
    SELECT atttypid::regtype::text FROM pg_attribute
    WHERE attrelid = 'sqerge_migration'::regclass AND attname = 'prefix';
  `.values();

  if (type === 'integer') {
    await sql`ALTER TABLE sqerge_migration ALTER COLUMN prefix TYPE bigint;`;
  }
}

// Returns the migrated filenames, in the order they ran.
async function getMigrations(sql: Sql): Promise<string[]> {
  const rows = await sql`
    SELECT file FROM sqerge_migration ORDER BY "id";
  `.values();

  return rows.map(([file]) => file);
}

function insertMigration(sql: Sql, prefix: number, file: string) {
  return sql`INSERT INTO sqerge_migration ("prefix", "file") VALUES (${prefix}, ${file});`;
}

async function executeFile(
  sql: Sql,
  fileDir: string,
  { prefix, file, noTransaction }: MigrationFile,
  count: number,
  log?: typeof console.log,
) {
  const filePath = pathResolve(fileDir, file);

  try {
    // In a transaction, insert first, so a duplicate prefix fails before the
    // file runs. Without one, insert after, so a failed file isn't recorded.
    if (!noTransaction) await insertMigration(sql, prefix, file);

    if (file.endsWith('sql')) {
      await sql.file(filePath);
    } else {
      await executeJsMigrationFile(sql, filePath);
    }

    if (noTransaction) await insertMigration(sql, prefix, file);
  } catch (error) {
    log && !noTransaction && log('rollback...');

    if (error instanceof PostgresError) {
      if (
        error.code === '23505' &&
        error.constraint_name === 'sqerge_migration_prefix_key'
      ) {
        throw duplicatePrefixError(count, file, prefix);
      }

      // PostgreSQL runs a query with more than one statement in a
      // transaction, and sqerge sends a SQL file as one query.
      const hint =
        noTransaction && file.endsWith('sql') && error.code === '25001'
          ? '. PostgreSQL runs a SQL file with more than one statement in a transaction, so put this statement in a file of its own'
          : '';

      throw new SqergeError(
        'sql_error',
        fileMessage(count, file, `(sql execution) ${error.message}${hint}`),
      );
    } else {
      throw error;
    }
  }

  log && log(fileMessage(count, file, 'executed'));
}

async function executeJsMigrationFile(sql: Sql, filePath: string) {
  const module = await import(filePath);

  if (typeof module.default === 'function') {
    await module.default(sql);
  } else {
    throw new SqergeError(
      'invalid_js_migration_file',
      'file %O default export must be a function',
      filePath,
    );
  }
}

function duplicatePrefixError(count: number, file: string, prefix: number) {
  return new SqergeError(
    'duplicate_prefix',
    fileMessage(
      count,
      file,
      'prefix (%O) in filename is already in use',
      prefix,
    ),
  );
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
    ...args,
  );
}
