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

  describe('test-1', () => {
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
  });

  describe('test-2', () => {
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
      expect(result).toContain('rollback...');
      expect(result).toContain('relation "people" does not exist');
      expect(
        await sql`SELECT * FROM information_schema.tables where "table_name" = 'person';`
      ).toEqual([]);
    });
  });

  describe('test-3', () => {
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
});
