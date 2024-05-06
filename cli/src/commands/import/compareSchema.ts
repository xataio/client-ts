import { PgRollOperation } from '@xata.io/pgroll';
import { PartialDeep } from 'type-fest';
import { Schemas } from '@xata.io/client';
import { generateLinkReference, tableNameFromLinkComment, xataColumnTypeToPgRoll } from '../../migrations/pgroll.js';

export function compareSchemas(
  source: PartialDeep<Schemas.BranchSchema>,
  target: PartialDeep<Schemas.BranchSchema>
): { edits: PgRollOperation[] } {
  const edits: PgRollOperation[] = [];

  // Compare tables
  const sourceTables = Object.keys(source.tables ?? {});
  const targetTables = Object.keys(target.tables ?? {});
  const newTables = targetTables.filter((table) => !sourceTables.includes(table));
  const deletedTables = sourceTables.filter((table) => !targetTables.includes(table));

  // Compare columns
  for (const table of sourceTables) {
    const sourceColumns = Object.keys(source.tables?.[table]?.columns ?? {});
    const targetColumns = Object.keys(target.tables?.[table]?.columns ?? {});
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

    // Compare column properties
    for (const column of targetColumns) {
      const sourceProps = source.tables?.[table]?.columns?.[column] ?? {};
      const targetProps = target.tables?.[table]?.columns?.[column] ?? {};

      if (sourceProps.type !== targetProps.type) {
        edits.push({
          alter_column: {
            table,
            column,
            type: targetProps.type,
            references:
              targetProps?.type === 'link' && targetProps?.name
                ? generateLinkReference({
                    column: targetProps.name,
                    table: tableNameFromLinkComment(targetProps?.comment ?? '') ?? ''
                  })
                : undefined
          }
        });
      }

      if (sourceProps.nullable !== targetProps.nullable) {
        edits.push({ alter_column: { table, column, nullable: targetProps.nullable } });
      }

      if (sourceProps.unique !== targetProps.unique) {
        edits.push({
          alter_column: {
            table,
            column,
            unique: {
              name: `${table}_${column}_unique`
            }
          }
        });
      }
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
        columns: Object.entries(props.columns ?? {}).map(([name, column]) => {
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
