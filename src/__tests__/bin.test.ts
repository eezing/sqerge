import { execSync } from 'child_process';
import postgres, { Sql } from 'postgres';

const PGHOST = 'localhost';
const PGPORT = 5438;
const PGUSER = 'jonathan';
const PGPASSWORD = 'iliketurtles';
const PGDATABASE = 'dev';

describe('bin.js', () => {
  let sql: Sql<{}>;

  beforeEach(() => {
    execSync('npm run dev:postgres');

    sql = postgres({
      host: PGHOST,
      port: PGPORT,
      user: PGUSER,
      password: PGPASSWORD,
      database: PGDATABASE,
    });
  });

  afterEach(() => sql.end());

  test('test-1: Should create person table with 1 row', async () => {
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

  test('test-2: Should rollback on bad table name in sql file insert statement', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./src/__tests__/bin/test-2`;

    // Act
    try {
      execSync(command).toString();
    } catch (error: any) {
      var result = error.stdout.toString();
    }

    // Assert
    expect(result).toContain('rollback...');
    expect(result).toContain('relation "people" does not exist');
    expect(
      await sql`SELECT * FROM information_schema.tables where "table_name" = 'person';`
    ).toEqual([]);
  });

  test('test-3: Should create person table with 1 row when non-sequential prefix in filenames', async () => {
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
