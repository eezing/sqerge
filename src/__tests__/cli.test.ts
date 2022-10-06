import { execSync } from 'child_process';
import postgres, { Sql } from 'postgres';

const PGHOST = 'localhost';
const PGPORT = '5438';
const PGUSER = 'jonathan';
const PGPASSWORD = 'iliketurtles';
const PGDATABASE = 'dev';

describe('migrate', () => {
  let sql: Sql<{}>;

  beforeEach(() => {
    execSync('npm run dev:postgres');

    sql = postgres({
      connection: {
        host: PGHOST,
        port: PGPORT,
        user: PGUSER,
        password: PGPASSWORD,
        database: PGDATABASE,
      },
    });
  });

  afterEach(async () => {
    await sql.end();
  });

  test('examples/basic should execute successfully', async () => {
    // Arrange
    const command = `PGHOST=${PGHOST} PGPORT=${PGPORT} PGUSER=${PGUSER} PGPASSWORD=${PGPASSWORD} PGDATABASE=${PGDATABASE} sqerge ./examples/basic`;

    // Act
    const result = execSync(command).toString();

    // Assert
    expect(result.match(/executed/g)?.length).toBe(3);
  });
});
