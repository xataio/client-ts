import { Schemas } from '@xata.io/client';

type TableOpAdd = {
  table: string;
};
type TableOpRemove = {
  table: string;
};
type TableOpRename = {
  oldName: string;
  newName: string;
};
type MigrationTableOp =
  | {
      addTable: TableOpAdd;
    }
  | {
      removeTable: TableOpRemove;
    }
  | {
      renameTable: TableOpRename;
    };
type ColumnOpAdd = {
  table: string;
  column: Column;
};
type ColumnOpRemove = {
  table: string;
  column: string;
};
type ColumnOpRename = {
  table: string;
  oldName: string;
  newName: string;
};
type MigrationColumnOp =
  | {
      addColumn: ColumnOpAdd;
    }
  | {
      removeColumn: ColumnOpRemove;
    }
  | {
      renameColumn: ColumnOpRename;
    };

type MigrationOp = MigrationTableOp | MigrationColumnOp;

type Column = {
  name: string;
  type: 'bool' | 'int' | 'float' | 'string' | 'text' | 'email' | 'multiple' | 'link' | 'object' | 'datetime';
  link?: ColumnLink;
  notNull?: boolean;
  defaultValue?: string;
  unique?: boolean;
  columns?: Column[];
};

type ColumnLink = {
  table: string;
};

export function buildMigrationDiff(ops: Schemas.MigrationOp[]): string {
  const lines = ops.map((op) => {
    if ('addTable' in op) {
      return `+ Table ${op.addTable.table}`;
    } else if ('removeTable' in op) {
      return `- Table ${op.removeTable.table}`;
    } else if ('renameTable' in op) {
      return `~ Table ${op.renameTable.oldName} -> ${op.renameTable.newName}`;
    } else if ('addColumn' in op) {
      return `+ Column ${op.addColumn.table}.${op.addColumn.column.name}`;
    } else if ('removeColumn' in op) {
      return `- Column ${op.removeColumn.table}.${op.removeColumn.column}`;
    } else if ('renameColumn' in op) {
      return `~ Column ${op.renameColumn.table}.${op.renameColumn.oldName} -> ${op.renameColumn.newName}`;
    }
  });

  return lines.join('\n');
}
