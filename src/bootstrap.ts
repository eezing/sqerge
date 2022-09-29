import { Command } from 'commander';
import { resolve as pathResolve } from 'node:path';
import history from './actions/history';
import migrate from './actions/migrate';
import next from './actions/next';
import { sqlInit, withActionWrapper } from './utils';

const migrateAction = withActionWrapper(migrate);
const nextAction = withActionWrapper(next);
const historyAction = withActionWrapper(history);

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
  .option('--flag [string...]', 'flag(s) passed to .js migration files')
  .action((dir, options) =>
    migrateAction(sqlInit(options), pathResolve(dir), options.flag)
  );

program
  .command('next')
  .description('list files in next migration')
  .argument('<dir>', 'path to directory of migration files')
  .option('--host <PGHOST>', 'database server host')
  .option('--port <PGPORT>', 'database server port')
  .option('--user <PGUSER>', 'database user')
  .option('--password <PGPASSWORD>', 'user password')
  .option('--database <PGDATABASE>', 'database name')
  .action((dir, options) => nextAction(sqlInit(options), pathResolve(dir)));

program
  .command('history')
  .description('list of previous migrations')
  .option('--host <PGHOST>', 'database server host')
  .option('--port <PGPORT>', 'database server port')
  .option('--user <PGUSER>', 'database user')
  .option('--password <PGPASSWORD>', 'user password')
  .option('--database <PGDATABASE>', 'database name')
  .action((options) => historyAction(sqlInit(options)));

program.parse();
