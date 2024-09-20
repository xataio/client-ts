import { PgRollOperation } from '@xata.io/pgroll';
import { PartialDeep } from 'type-fest';
import { Schemas } from '@xata.io/client';
import { generateLinkReference, tableNameFromLinkComment, xataColumnTypeToPgRoll } from '../migrations/pgroll.js';
import { INTERNAL_COLUMNS_PGROLL } from '../commands/import/csv.js';

export function compareSchemas({
  source,
  target
}: {
  source: PartialDeep<Schemas.BranchSchema>;
  target: PartialDeep<Schemas.BranchSchema>;
}): { edits: PgRollOperation[] } {
  const edits: PgRollOperation[] = [];

  // Compare tables
  const sourceTables = Object.keys(source.tables ?? {});
  const targetTables = Object.keys(target.tables ?? {});
  const newTables = targetTables.filter((table) => !sourceTables.includes(table));
  const deletedTables = sourceTables.filter((table) => !targetTables.includes(table));

  // Compare columns
  for (const table of sourceTables) {
    const sourceColumns = Object.keys(source.tables?.[table]?.columns ?? {}).filter(
      (c) => !INTERNAL_COLUMNS_PGROLL.includes(c)
    );
    const targetColumns = Object.keys(target.tables?.[table]?.columns ?? {}).filter(
      (c) => !INTERNAL_COLUMNS_PGROLL.includes(c)
    );
    const newColumns = targetColumns.filter((column) => !sourceColumns.includes(column));
    const deletedColumns = sourceColumns.filter((column) => !targetColumns.includes(column));

    // Add columns
    for (const column of newColumns) {
      const props = target.tables?.[table]?.columns?.[column] ?? {};
      edits.push({
        add_column: {
          table,
          column: {
            name: column,
            type: xataColumnTypeToPgRoll(props?.type as any),
            comment: props?.comment,
            nullable: !(props?.nullable === false),
            unique: props?.unique,
            default: props?.default ?? undefined,
            references:
              props?.type === 'link' && props?.name
                ? generateLinkReference({
                    column: props.name,
                    table: tableNameFromLinkComment(props?.comment ?? '') ?? ''
                  })
                : undefined
          }
        }
      });
    }

    // Delete columns
    for (const column of deletedColumns) {
      edits.push({ drop_column: { table, column } });
    }
  }

  // Delete tables
  for (const table of deletedTables) {
    edits.push({ drop_table: { name: table } });
  }

  // Add new tables
  for (const table of newTables) {
    const props = target.tables?.[table] ?? {};
    edits.push({
      create_table: {
        name: table,
        comment: props.comment,
        columns: Object.entries(props.columns ?? {})
          .filter(([name, _]) => !INTERNAL_COLUMNS_PGROLL.includes(name))
          .map(([name, column]) => {
            return {
              name,
              type: xataColumnTypeToPgRoll(column?.type as any),
              comment: column?.comment,
              nullable: !(column?.nullable === false),
              unique: column?.unique,
              default: column?.default ?? undefined,
              references:
                column?.type === 'link' && column?.name
                  ? generateLinkReference({
                      column: column?.name,
                      table: tableNameFromLinkComment(column?.comment ?? '') ?? ''
                    })
                  : undefined
            };
          })
      }
    });
  }
  return { edits };
}

export const inferOldSchemaToNew = (
  oldSchema: Pick<Schemas.DBBranch, 'schema' | 'branchName'>
): Schemas.BranchSchema => {
  const schema: Schemas.BranchSchema = {
    name: oldSchema.branchName,
    tables: Object.fromEntries(
      oldSchema.schema.tables.map((table) => [
        table.name,
        {
          name: table.name,
          xataCompatible: true,
          comment: '',
          primaryKey: 'id',
          uniqueConstraints: [],
          checkConstraints: [],
          foreignKeys: [],
          columns: Object.fromEntries(
            table.columns.map((column) => [
              column.name,
              {
                name: column.name,
                type: oldColumnTypeToNew(column),
                comment: generateCommentFromOldColumn(column),
                nullable: !(column.notNull === true),
                unique: column.unique === true,
                defaultValue: column.defaultValue
              }
            ])
          )
        }
      ]) as any
    )
  };

  return schema;
};

const oldColumnTypeToNew = (oldColumn: Schemas.Column) => {
  // These types will be limited to the original deprecated Xata types
  switch (oldColumn.type) {
    case 'bool':
      return 'boolean';
    case 'datetime':
      return 'timestamptz';
    case 'vector':
      return 'vector';
    case 'json':
      return 'jsonb';
    case 'file':
      return 'xata_file';
    case 'file[]':
      return 'xata_file_array';
    case 'int':
      return 'integer';
    case 'float':
      return 'real';
    case 'multiple':
      return 'text[]';
    case 'text':
    case 'string':
    case 'email':
      return 'text';
    case 'link':
      return 'link';
    default:
      return 'text';
  }
};

const generateCommentFromOldColumn = (oldColumn: Schemas.Column) => {
  switch (oldColumn.type) {
    case 'vector':
      return JSON.stringify({ 'xata.search.dimension': oldColumn.vector?.dimension });
    case 'file':
      return JSON.stringify({ 'xata.file.dpa': oldColumn?.file?.defaultPublicAccess });
    case 'file[]':
      return JSON.stringify({ 'xata.file.dpa': oldColumn?.['file[]']?.defaultPublicAccess });
    case 'link':
      return oldColumn.link?.table ? generateLinkComment(oldColumn.link?.table) : '';
    case 'string':
    case 'email':
      return JSON.stringify({ 'xata.type': oldColumn.type });
    default:
      return '';
  }
};

const generateLinkComment = (tableName: string) => {
  return JSON.stringify({ 'xata.link': tableName });
};
