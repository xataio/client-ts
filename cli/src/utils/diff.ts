import { Schemas } from '@xata.io/client';
import chalk from 'chalk';

export function buildMigrationDiff(ops: Schemas.MigrationOp[]): string {
  const lines = ops.map((op) => {
    if ('addTable' in op) {
      return `${chalk.green('+')} ${chalk.bold(op.addTable.table)}`;
    } else if ('removeTable' in op) {
      return `${chalk.red('-')} ${chalk.bold(op.removeTable.table)}`;
    } else if ('renameTable' in op) {
      return `${chalk.yellow('~')} ${chalk.bold(op.renameTable.oldName)} -> ${chalk.bold(op.renameTable.newName)}`;
    } else if ('addColumn' in op) {
      return `${chalk.green('+')} ${chalk.bold(op.addColumn.table)}.${chalk.bold(op.addColumn.column.name)}`;
    } else if ('removeColumn' in op) {
      return `${chalk.red('-')} ${chalk.bold(op.removeColumn.table)}.${chalk.bold(op.removeColumn.column)}`;
    } else if ('renameColumn' in op) {
      return `${chalk.yellow('~')} ${chalk.bold(op.renameColumn.table)}.${chalk.bold(
        op.renameColumn.oldName
      )} -> ${chalk.bold(op.renameColumn.newName)}`;
    } else {
      throw new Error(`Unknown migration op: ${JSON.stringify(op)}`);
    }
  });

  return lines.join('\n');
}
