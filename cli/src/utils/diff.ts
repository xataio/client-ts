import { Schemas } from '@xata.io/client';
import chalk from 'chalk';

export function buildMigrationDiff(ops: Schemas.MigrationOp[]): string {
  const lines = ops.map((op) => {
    if ('addTable' in op) {
      return chalk`{green +} {bold ${op.addTable.table}}`;
    } else if ('removeTable' in op) {
      return chalk`{red -} {bold ${op.removeTable.table}}`;
    } else if ('renameTable' in op) {
      return chalk`{yellow ~} {bold ${op.renameTable.oldName}} -> {bold ${op.renameTable.newName}}`;
    } else if ('addColumn' in op) {
      return chalk`{green +} {bold ${op.addColumn.table}}.{bold ${op.addColumn.column.name}}`;
    } else if ('removeColumn' in op) {
      return chalk`{red -} {bold ${op.removeColumn.table}}.{bold ${op.removeColumn.column}}`;
    } else if ('renameColumn' in op) {
      return chalk`{yellow ~} {bold ${op.renameColumn.table}}.{bold ${op.renameColumn.oldName}} -> {bold ${op.renameColumn.newName}}`;
    } else {
      throw new Error(`Unknown migration op: ${JSON.stringify(op)}`);
    }
  });

  return lines.join('\n');
}
