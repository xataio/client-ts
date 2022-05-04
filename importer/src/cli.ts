import { program } from 'commander';
import { run } from './cli-run.js';
import { IMPORTER_VERSION } from './version.js';

program
  .name('xata-importer')
  .description('Importer utility for xata.io')
  .version(IMPORTER_VERSION)
  .argument('<file>', 'File containing the data to import. Pass "-" to pipe content instead.')
  .option('--table <table>', 'The table in which to import the data.')
  .option('--columns <columns>', 'List of column names.')
  .option('--types <types>', 'List of column names.')
  .option('--noheader', 'Specify that the CSV file has no header.')
  .option('--format <format>', 'The format of the input source.', 'csv')
  .option('--create', "Whether the table or columns should be created if they don't exist.", false)
  .option('--force', 'Whather confirmation should be asked when creating the table or columns.', false)
  .option('--branch <branch>', 'The branch to import data to.', 'main')
  .option('--xatadir <xatadir>', 'The path to your xata directory.', 'xata')
  .action(run);

program.parse();
