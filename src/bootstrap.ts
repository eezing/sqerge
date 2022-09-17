import { Command } from 'commander';
const program = new Command();

program.name('sqerge').description('Another SQL (PostgreSQL) migration tool');

program
  .command('push')
  .description('execute migration')
  .option('-e, --environment <char>', 'target environment')
  .action((options) => {
    console.log(options);
  });

program.parse();
