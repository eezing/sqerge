import { Command } from 'commander';
import { resolve as pathResolve } from 'node:path';
import migrate from './index';
import { log, sqlInit, withActionWrapper } from './utils';

const migrateAction = withActionWrapper(migrate);

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
  .action((dir, options) =>
    migrateAction(sqlInit(options), pathResolve(dir), log)
  );

program.parse();
