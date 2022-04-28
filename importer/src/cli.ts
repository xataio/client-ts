import { program } from 'commander';
import { run } from './cli-run.js';

program
  .name('xata-importer')
  .description('Importer utility for xata.io')
  // .version(IMPORTER_VERSION) // TODO
  .argument('<file>', 'File containing the data to import. Pass "-" to pipe content instead.')
  .option('--table <table>', 'The table in which to import the data.')
  .option('--columns <columns>', 'List of column names.')
  .option('--types <types>', 'List of column names.')
  .option('--noheader', 'Specify that the CSV file has no header.')
  .option('--format', 'The format of the input source.', 'csv')
  .option('--create', "Whether the table or columns should be created if they don't exist.", false)
  .option('--force', 'Whather confirmation should be asked when creating the table or columns.', false)
  .action(run);

program.parse();
