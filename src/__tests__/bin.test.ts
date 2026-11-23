import { exec, execSync } from 'child_process';
import { rmSync, writeFileSync } from 'fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { promisify } from 'node:util';
import postgres, { Sql } from 'postgres';
import migrate from '../index';

const execAsync = promisify(exec);

const stripColor = (value: string) =>
  value.replace(
    new RegExp(
      [
        '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
        '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
      ].join('|'),
      'g',
    ),
    '',
  );

const PGHOST = 'localhost';
const PGPORT = 5438;
const PGUSER = 'jonathan';
const PGPASSWORD = 'iliketurtles';
const PGDATABASE = 'test';

let admin: Sql<{}>;
let sql: Sql<{}>;

beforeAll(() => {
  admin = postgres({
    host: PGHOST,
    port: PGPORT,
    user: PGUSER,
    password: PGPASSWORD,
    database: 'postgres',
    onnotice: () => {},
  });
});

beforeEach(async () => {
  sql && (await sql.end());
  await admin`drop database if exists ${admin(PGDATABASE)};`;
  await admin`create database ${admin(PGDATABASE)};`;

  sql = postgres({
    host: PGHOST,
    port: PGPORT,
    user: PGUSER,
    password: PGPASSWORD,
    database: PGDATABASE,
    onnotice: () => {},
  });
});

afterAll(() => {
  admin.end();
  sql.end();
});

describe('./test-1', () => {
  beforeAll(() => {
    rmSync('./src/__tests__/bin/test-1/5-data.sql', { force: true });
  });

  test('Should create person table with 1 row', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-1`;

    // Act
    const result = execSync(command).toString();

    // Assert
    expect(result.match(/executed/g)?.length).toBe(4);
    expect(await sql`select * from person;`).toEqual([
      { id: 1, name: 'Luke Skywalker', age: 21 },
      { id: 2, name: 'Han Solo', age: 25 },
    ]);
  });

  test('Second run should do nothing', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-1`;

    // Act (run 1)
    const run1 = execSync(command).toString();

    // Assert (run 1)
    expect(run1.match(/executed/g)?.length).toBe(4);
    expect(await sql`select * from person;`).toEqual([
      { id: 1, name: 'Luke Skywalker', age: 21 },
      { id: 2, name: 'Han Solo', age: 25 },
    ]);

    // Act (run 2)
    const run2 = execSync(command).toString();

    // Assert (run 2)
    expect(run2.match(/already migrated/g)?.length).toBe(4);
    expect(await sql`select * from person;`).toEqual([
      { id: 1, name: 'Luke Skywalker', age: 21 },
      { id: 2, name: 'Han Solo', age: 25 },
    ]);
  });

  test('Second run with new file should execute new file', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-1`;

    // Act (run 1)
    const run1 = execSync(command).toString();

    // Assert (run 1)
    expect(run1.match(/executed/g)?.length).toBe(4);
    expect(await sql`select * from person;`).toEqual([
      { id: 1, name: 'Luke Skywalker', age: 21 },
      { id: 2, name: 'Han Solo', age: 25 },
    ]);

    // Act (run 2)
    writeFileSync(
      './src/__tests__/bin/test-1/5-data.sql',
      `INSERT INTO person ("name", "age") VALUES ('C3PO', '100');`,
    );
    const run2 = execSync(command).toString();

    // Assert (run 2)
    expect(run2.match(/already migrated/g)?.length).toBe(4);
    expect(run2.match(/executed/g)?.length).toBe(1);
    expect(await sql`select * from person;`).toEqual([
      { id: 1, name: 'Luke Skywalker', age: 21 },
      { id: 2, name: 'Han Solo', age: 25 },
      { id: 3, name: 'C3PO', age: 100 },
    ]);
  });
});

describe('./test-2', () => {
  test('Should rollback on bad table name in sql file insert statement', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-2`;

    // Act
    try {
      execSync(command).toString();
    } catch (error: any) {
      var stdout = error.stdout.toString();
      var stderr = error.stderr.toString();
    }

    // Assert
    expect(stripColor(stdout)).toContain('[sqerge] rollback...');
    expect(stripColor(stderr)).toContain(
      '[sqerge] (error) file 2 (2-schema.sql): (sql execution) relation "people" does not exist',
    );
    expect(
      await sql`SELECT * FROM information_schema.tables where "table_name" = 'person';`,
    ).toEqual([]);
  });
});

describe('./test-3', () => {
  test('Should create person table with 1 row when non-sequential prefix in filenames', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-3`;

    // Act
    const result = execSync(command).toString();

    // Assert
    expect(result.match(/executed/g)?.length).toBe(3);
    expect(await sql`select * from person;`).toEqual([
      { id: 1, name: 'Luke Skywalker', age: 21 },
    ]);
  });
});

describe('./test-4', () => {
  test('Should rollback and error when files have duplicate prefix', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-4`;

    // Act
    try {
      execSync(command).toString();
    } catch (error: any) {
      var stdout = error.stdout.toString();
      var stderr = error.stderr.toString();
    }

    // Assert
    expect(stripColor(stdout)).toContain('[sqerge] rollback...');
    expect(stripColor(stderr)).toContain(
      '[sqerge] (error) file 2 (1-schema-B.sql): prefix (1) in filename is already in use',
    );
    expect(
      await sql`SELECT * FROM information_schema.tables where "table_name" = 'person';`,
    ).toEqual([]);
  });
});

describe('./test-5', () => {
  test('Should have 3 tables owned by custom role if env.ROLE is defined', async () => {
    // Arrange
    const role = 'foobar';
    await sql`drop role if exists ${sql(role)}`;
    await sql`create role ${sql(role)} with superuser;`;
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} ROLE=${role} node bin.js ./src/__tests__/bin/test-5`;

    // Act
    const result = execSync(command).toString();

    // Assert
    expect(result.match(/executed/g)?.length).toBe(3);
    expect(
      (
        await sql`select from pg_tables where tableowner = ${role} and tablename in ('person', 'friend', 'enemy');`
      ).length,
    ).toBe(3);
  });
});

describe('./test-6', () => {
  test('Should execute no-transaction files outside of a transaction', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-6`;

    // Act
    const result = execSync(command).toString();

    // Assert
    expect(result.match(/executed/g)?.length).toBe(5);
    expect(
      await sql`select indexname from pg_indexes where tablename = 'person' order by indexname;`,
    ).toEqual([
      { indexname: 'person_age_idx' },
      { indexname: 'person_name_idx' },
      { indexname: 'person_pkey' },
    ]);
    expect(await sql`select * from person;`).toEqual([
      { id: 1, name: 'Luke Skywalker', age: 21 },
    ]);
  });

  test('Second run should do nothing', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-6`;

    // Act (run 1)
    const run1 = execSync(command).toString();

    // Assert (run 1)
    expect(run1.match(/executed/g)?.length).toBe(5);

    // Act (run 2)
    const run2 = execSync(command).toString();

    // Assert (run 2)
    expect(run2.match(/already migrated/g)?.length).toBe(5);
    expect(run2).not.toContain('executed');
  });
});

describe('./test-7', () => {
  test('Should keep files before a failed no-transaction file', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-7`;

    // Act
    try {
      execSync(command).toString();
    } catch (error: any) {
      var stdout = error.stdout.toString();
      var stderr = error.stderr.toString();
    }

    // Assert
    expect(stripColor(stdout)).not.toContain('rollback...');
    expect(stripColor(stderr)).toContain(
      '[sqerge] (error) file 2 (2-index.no-transaction.sql): (sql execution) column "age" does not exist',
    );
    expect(await sql`select file from sqerge_migration order by id;`).toEqual([
      { file: '1-schema.sql' },
    ]);
  });
});

describe('./test-8', () => {
  test('Should rollback only files after the last no-transaction file', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-8`;

    // Act
    try {
      execSync(command).toString();
    } catch (error: any) {
      var stdout = error.stdout.toString();
      var stderr = error.stderr.toString();
    }

    // Assert
    expect(stripColor(stdout)).toContain('[sqerge] rollback...');
    expect(stripColor(stderr)).toContain(
      '[sqerge] (error) file 4 (4-data.sql): (sql execution) relation "people" does not exist',
    );
    expect(await sql`select file from sqerge_migration order by id;`).toEqual([
      { file: '1-schema.sql' },
      { file: '2-index.no-transaction.sql' },
    ]);
    expect(
      await sql`SELECT * FROM information_schema.tables where "table_name" = 'friend';`,
    ).toEqual([]);
  });
});

describe('./test-9', () => {
  test('Should not execute no-transaction file with duplicate prefix', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-9`;

    // Act
    try {
      execSync(command).toString();
    } catch (error: any) {
      var stderr = error.stderr.toString();
    }

    // Assert
    expect(stripColor(stderr)).toContain(
      '[sqerge] (error) file 2 (1-schema-B.no-transaction.sql): prefix (1) in filename is already in use',
    );
    expect(
      await sql`select indexname from pg_indexes where indexname = 'person_name_idx';`,
    ).toEqual([]);
  });
});

describe('./test-10', () => {
  test('Should keep its connection for the run when max lifetime is short', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} PGMAX_LIFETIME=1 node bin.js ./src/__tests__/bin/test-10`;

    // Act
    const result = execSync(command).toString();

    // Assert
    expect(result.match(/executed/g)?.length).toBe(2);
    expect(await sql`select file from sqerge_migration order by id;`).toEqual([
      { file: '1-schema.sql' },
      { file: '2-index.no-transaction.sql' },
    ]);
  });
});

describe('./test-11', () => {
  test('Should not execute any file when a prefix is too large', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-11`;

    // Act
    try {
      execSync(command).toString();
    } catch (error: any) {
      var stderr = error.stderr.toString();
    }

    // Assert
    expect(stripColor(stderr)).toContain(
      '[sqerge] (error) file 2 (99999999999999999-data.sql): prefix in filename is larger than 9007199254740991',
    );
    expect(
      await sql`SELECT * FROM information_schema.tables where "table_name" = 'person';`,
    ).toEqual([]);
  });
});

describe('./test-12', () => {
  test('Should exit with an error if the run stalls', async () => {
    // Arrange (close the CLI's idle connection, so nothing keeps the process alive)
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} PGIDLE_TIMEOUT=1 node bin.js ./src/__tests__/bin/test-12`;

    // Act
    try {
      execSync(command, { timeout: 10000 }).toString();
    } catch (error: any) {
      var status = error.status;
      var stderr = error.stderr.toString();
    }

    // Assert
    expect(status).toBe(1);
    expect(stripColor(stderr)).toContain(
      '[sqerge] (error) exited before the migration finished',
    );
  });
});

describe('./test-13', () => {
  test('Should run one migration at a time', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-13`;

    // Act (start a second run while the first holds the lock)
    const [run1, run2] = await Promise.all([
      execAsync(command),
      sleep(300).then(() => execAsync(command)),
    ]);

    // Assert
    const output = stripColor(run1.stdout + run2.stdout);
    expect(
      output.match(/waiting for another migration to finish/g)?.length,
    ).toBe(1);
    expect(output.match(/executed/g)?.length).toBe(3);
    expect(output.match(/already migrated/g)?.length).toBe(3);
    expect(await sql`select name from person;`).toEqual([
      { name: 'Luke Skywalker' },
    ]);
  });
});

describe('./test-14', () => {
  const createLegacyTable = () => sql`
    CREATE TABLE sqerge_migration (
      id SERIAL NOT NULL PRIMARY KEY,
      prefix int NOT NULL UNIQUE,
      file text NOT NULL UNIQUE,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    );
  `;

  const getPrefixType = () =>
    sql`select atttypid::regtype::text as type from pg_attribute where attrelid = 'sqerge_migration'::regclass and attname = 'prefix';`;

  test('Should execute files with timestamp prefixes', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-14`;

    // Act
    const result = execSync(command).toString();

    // Assert
    expect(result.match(/executed/g)?.length).toBe(3);
    expect(
      await sql`select prefix, file from sqerge_migration order by id;`,
    ).toEqual([
      { prefix: '1', file: '1-schema.sql' },
      { prefix: '20261123120000', file: '20261123120000-data.sql' },
      {
        prefix: '20261123120100',
        file: '20261123120100-index.no-transaction.sql',
      },
    ]);
  });

  test('Should widen prefix column from earlier versions for timestamp prefixes', async () => {
    // Arrange
    await createLegacyTable();
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-14`;

    // Act
    const result = execSync(command).toString();

    // Assert
    expect(result.match(/executed/g)?.length).toBe(3);
    expect(await getPrefixType()).toEqual([{ type: 'bigint' }]);
  });

  test('Should keep prefix column from earlier versions when prefixes fit', async () => {
    // Arrange
    await createLegacyTable();
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-3`;

    // Act
    const result = execSync(command).toString();

    // Assert
    expect(result.match(/executed/g)?.length).toBe(3);
    expect(await getPrefixType()).toEqual([{ type: 'integer' }]);
  });
});

describe('./test-15', () => {
  test('Should explain why a no-transaction SQL file with several statements fails', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-15`;

    // Act
    try {
      execSync(command).toString();
    } catch (error: any) {
      var stderr = error.stderr.toString();
    }

    // Assert
    expect(stripColor(stderr)).toContain(
      '[sqerge] (error) file 2 (2-index.no-transaction.sql): (sql execution) CREATE INDEX CONCURRENTLY cannot run inside a transaction block. PostgreSQL runs a SQL file with more than one statement in a transaction, so put this statement in a file of its own',
    );
  });
});

describe('./test-16', () => {
  test('Should stop instead of reconnecting when its connection closes', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-16`;

    // Act
    try {
      execSync(command, { timeout: 10000 }).toString();
    } catch (error: any) {
      var stderr = error.stderr.toString();
    }

    // Assert
    expect(stripColor(stderr)).toContain(
      '[sqerge] (error) database connection closed',
    );
    expect(await sql`select file from sqerge_migration order by id;`).toEqual([
      { file: '1-schema.sql' },
    ]);
    expect(await sql`select * from person;`).toEqual([]);
  });
});

describe('./test-17', () => {
  test('Should stop cleanly when its connection closes in a transaction', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-17`;

    // Act
    try {
      execSync(command, { timeout: 10000 }).toString();
    } catch (error: any) {
      var status = error.status;
      var stderr = error.stderr.toString();
    }

    // Assert
    expect(status).toBe(1);
    expect(stripColor(stderr)).toContain(
      '[sqerge] (error) database connection closed',
    );
    expect(stderr).not.toContain('TypeError');
    expect(
      await sql`SELECT * FROM information_schema.tables where "table_name" = 'person';`,
    ).toEqual([]);
  });
});

describe('./test-18', () => {
  test('Should print an error whose code is not a string', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-18`;

    // Act
    try {
      execSync(command).toString();
    } catch (error: any) {
      var status = error.status;
      var stderr = error.stderr.toString();
    }

    // Assert
    expect(status).toBe(1);
    expect(stderr).toContain('The operation was aborted');
    expect(stderr).not.toContain('is not a function');
  });
});

describe('connection', () => {
  test('Should show the refused addresses when the database is down', async () => {
    // Arrange
    const command = `PGHOST=localhost PGPORT=1 PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-1`;

    // Act
    try {
      execSync(command).toString();
    } catch (error: any) {
      var stderr = error.stderr.toString();
    }

    // Assert
    expect(stripColor(stderr)).toMatch(
      /\[sqerge\] \(error\) database connection refused at '.+:1'/,
    );
    expect(stderr).not.toContain('undefined');
  });
});

describe('migrate()', () => {
  const connect = () =>
    postgres({
      host: PGHOST,
      port: PGPORT,
      user: PGUSER,
      password: PGPASSWORD,
      database: PGDATABASE,
      max: 1,
      onnotice: () => {},
    });

  test("Should leave the caller's connection as it was", async () => {
    // Arrange
    const role = 'foobar';
    await sql`drop role if exists ${sql(role)}`;
    await sql`create role ${sql(role)} with superuser;`;
    const pool = connect();

    try {
      // Act
      await migrate(pool, './src/__tests__/bin/test-5', { role });

      // Assert
      expect(await pool`select current_user;`).toEqual([
        { current_user: PGUSER },
      ]);
      expect(
        await sql`select from pg_locks where locktype = 'advisory';`,
      ).toEqual([]);
    } finally {
      await pool.end();
    }
  });

  test("Should run with settings SET on the caller's connection", async () => {
    // Arrange
    const role = 'foobar';
    await sql`drop role if exists ${sql(role)}`;
    await sql`create role ${sql(role)} with superuser;`;
    await sql`create schema tenant_a;`;
    const pool = connect();
    await pool`set search_path to tenant_a;`;
    await pool`set role ${pool(role)};`;

    try {
      // Act
      await migrate(pool, './src/__tests__/bin/test-5');

      // Assert
      expect(
        await sql`select schemaname, tableowner from pg_tables where tablename in ('person', 'friend', 'enemy', 'sqerge_migration');`,
      ).toEqual(Array(4).fill({ schemaname: 'tenant_a', tableowner: role }));
    } finally {
      await pool.end();
    }
  });

  test("Should ignore the caller's column transform for its own queries", async () => {
    // Arrange
    const pool = postgres({
      host: PGHOST,
      port: PGPORT,
      user: PGUSER,
      password: PGPASSWORD,
      database: PGDATABASE,
      onnotice: () => {},
      transform: postgres.pascal,
    });

    try {
      // Act (run twice, to also read the migration history)
      await migrate(pool, './src/__tests__/bin/test-5');
      await migrate(pool, './src/__tests__/bin/test-5');

      // Assert
      expect(await sql`select file from sqerge_migration order by id;`).toEqual(
        [
          { file: '1-schema.sql' },
          { file: '2-schema.sql' },
          { file: '3-schema.no-transaction.sql' },
        ],
      );
    } finally {
      await pool.end();
    }
  });

  test('Should release the lock when a migration fails', async () => {
    // Arrange
    const pool = connect();

    try {
      // Act
      const result = migrate(pool, './src/__tests__/bin/test-2');

      // Assert
      await expect(result).rejects.toThrow('relation "people" does not exist');
      expect(
        await sql`select from pg_locks where locktype = 'advisory';`,
      ).toEqual([]);
    } finally {
      await pool.end();
    }
  });
});
