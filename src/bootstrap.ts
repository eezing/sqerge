import { Command } from 'commander';
import { resolve as pathResolve } from 'node:path';
import postgres from 'postgres';
import history from './actions/history';
import migrate from './actions/migrate';
import next from './actions/next';
import { withSqergeErrorHandler } from './utils';

const program = new Command();

program.name('sqerge').description('Another SQL (PostgreSQL) migration tool');

program
  .command('migrate')
  .description('execute migration')
  .argument('<dir>', 'path to directory of migration files')
  .option('--host <PGHOST>', 'database server host')
  .option('--port <PGPORT>', 'database server port')
  .option('--user <PGUSER>', 'database user')
  .option('--password <PGPASSWORD>', 'user password')
  .option('--database <PGDATABASE>', 'database name')
  .action(async (dir, options) => {
    await withSqergeErrorHandler(async () => {
      const sql = postgres({
        host: options.host,
        port: parseInt(options.port),
        user: options.user,
        password: options.password,
        database: options.database,
        onnotice: () => {},
      });

      try {
        await migrate(sql, pathResolve(dir));
      } catch (error) {
        throw error;
      } finally {
        await sql.end();
      }
    });
  });

program
  .command('next')
  .description('list files in next migration')
  .argument('<dir>', 'path to directory of migration files')
  .option('--host <PGHOST>', 'database server host')
  .option('--port <PGPORT>', 'database server port')
  .option('--user <PGUSER>', 'database user')
  .option('--password <PGPASSWORD>', 'user password')
  .option('--database <PGDATABASE>', 'database name')
  .action(async (dir, options) => {
    await withSqergeErrorHandler(async () => {
      const sql = postgres({
        host: options.host,
        port: parseInt(options.port),
        user: options.user,
        password: options.password,
        database: options.database,
        onnotice: () => {},
      });

      try {
        await next(sql, pathResolve(dir));
      } catch (error) {
        throw error;
      } finally {
        await sql.end();
      }
    });
  });

program
  .command('history')
  .description('list of previous migrations')
  .option('--host <PGHOST>', 'database server host')
  .option('--port <PGPORT>', 'database server port')
  .option('--user <PGUSER>', 'database user')
  .option('--password <PGPASSWORD>', 'user password')
  .option('--database <PGDATABASE>', 'database name')
  .action(async (options) => {
    await withSqergeErrorHandler(async () => {
      const sql = postgres({
        host: options.host,
        port: parseInt(options.port),
        user: options.user,
        password: options.password,
        database: options.database,
        onnotice: () => {},
      });

      try {
        await history(sql);
      } catch (error) {
        throw error;
      } finally {
        await sql.end();
      }
    });
  });

program.parse();
