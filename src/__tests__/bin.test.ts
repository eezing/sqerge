import { execSync } from 'child_process';
import postgres, { Sql } from 'postgres';

const PGHOST = 'localhost';
const PGPORT = 5438;
const PGUSER = 'jonathan';
const PGPASSWORD = 'iliketurtles';
const PGDATABASE = 'dev';

describe('execute migration', () => {
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

  test('examples/basic should create person table with 1 row', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} node bin.js ./examples/basic`;

    // Act
    const result = execSync(command).toString();

    // Assert
    expect(result.match(/executed/g)?.length).toBe(3);
    expect(await sql`select * from person;`).toEqual([
      { id: 1, name: 'Luke Skywalker', age: 21 },
    ]);
  });
});
