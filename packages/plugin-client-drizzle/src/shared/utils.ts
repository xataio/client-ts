import { AnyColumn, Column, DriverValueDecoder, SQL, SelectedFieldsOrdered, getTableName, is } from 'drizzle-orm';

export function mapResultRow<TResult>(
  columns: SelectedFieldsOrdered<AnyColumn>,
  row: unknown[],
  joinsNotNullableMap: Record<string, boolean> | undefined
): TResult {
  // Key -> nested object key, value -> table name if all fields in the nested object are from the same table, false otherwise
  const nullifyMap: Record<string, string | false> = {};

  const result = columns.reduce<Record<string, any>>((result, { path, field }, columnIndex) => {
    let decoder: DriverValueDecoder<unknown, unknown>;
    if (is(field, Column)) {
      decoder = field;
    } else if (is(field, SQL)) {
      decoder = (field as any).decoder;
    } else {
      decoder = (field.sql as any).decoder;
    }
    let node = result;
    for (const [pathChunkIndex, pathChunk] of path.entries()) {
      if (pathChunkIndex < path.length - 1) {
        if (!(pathChunk in node)) {
          node[pathChunk] = {};
        }
        node = node[pathChunk];
      } else {
        const rawValue = row[columnIndex]!;
        const value = (node[pathChunk] = rawValue === null ? null : decoder.mapFromDriverValue(rawValue));

        if (joinsNotNullableMap && is(field, Column) && path.length === 2) {
          const objectName = path[0]!;
          if (!(objectName in nullifyMap)) {
            nullifyMap[objectName] = value === null ? getTableName(field.table) : false;
          } else if (
            typeof nullifyMap[objectName] === 'string' &&
            nullifyMap[objectName] !== getTableName(field.table)
          ) {
            nullifyMap[objectName] = false;
          }
        }
      }
    }
    return result;
  }, {});

  // Nullify all nested objects from nullifyMap that are nullable
  if (joinsNotNullableMap && Object.keys(nullifyMap).length > 0) {
    for (const [objectName, tableName] of Object.entries(nullifyMap)) {
      if (typeof tableName === 'string' && !joinsNotNullableMap[tableName]) {
        result[objectName] = null;
      }
    }
  }

  return result as TResult;
}
