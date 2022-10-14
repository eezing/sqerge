import { execSync } from 'child_process';
import { rmSync, writeFileSync } from 'fs';
import postgres, { Sql } from 'postgres';

const stripColor = (value: string) =>
  value.replace(
    new RegExp(
      [
        '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
        '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
      ].join('|'),
      'g'
    ),
    ''
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
      `INSERT INTO person ("name", "age") VALUES ('C3PO', '100');`
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
      var result = error.stdout.toString();
    }

    // Assert
    expect(stripColor(result)).toContain('[sqerge] rollback...');
    expect(stripColor(result)).toContain(
      '[sqerge] (error) file 2 (2-schema.sql): (sql execution) relation "people" does not exist'
    );
    expect(
      await sql`SELECT * FROM information_schema.tables where "table_name" = 'person';`
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
      var result = error.stdout.toString();
    }

    // Assert
    expect(stripColor(result)).toContain('[sqerge] rollback...');
    expect(stripColor(result)).toContain(
      '[sqerge] (error) file 2 (1-schema-B.sql): prefix (1) in filename is already in use'
    );
    expect(
      await sql`SELECT * FROM information_schema.tables where "table_name" = 'person';`
    ).toEqual([]);
  });
});

describe('./test-5', () => {
  test('Should have 2 tables owned by custom role if env.ROLE is defined', async () => {
    // Arrange
    const role = 'foobar';
    await sql`drop role if exists ${sql(role)}`;
    await sql`create role ${sql(role)} with superuser;`;
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} ROLE=${role} node bin.js ./src/__tests__/bin/test-5`;

    // Act
    const result = execSync(command).toString();

    // Assert
    expect(result.match(/executed/g)?.length).toBe(2);
    expect(
      (
        await sql`select from pg_tables where tableowner = ${role} and tablename in ('person', 'friend');`
      ).length
    ).toBe(2);
  });
});
