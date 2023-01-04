import { z } from 'zod';
import type { Schemas } from '@xata.io/client';

export function schemaToZod(schema: Schemas.Schema) {
  const result: Record<string, z.AnyZodObject> = {};

  for (const table of schema.tables) {
    const tableSchema: Record<string, z.ZodFirstPartySchemaTypes> = {};

    for (const column of table.columns) {
      // Todo: Check other schema properties
      tableSchema[column.name] = typeToZod(column.type).nullable().optional();
    }

    result[table.name] = z.object(tableSchema);
  }

  return result;
}

function typeToZod(type: Schemas.Column['type']): z.ZodFirstPartySchemaTypes {
  switch (type) {
    case 'string':
    case 'text':
    case 'email':
      return z.string();
    case 'int':
    case 'float':
      return z.number();
    case 'bool':
      return z.boolean();
    case 'datetime':
      return z.union([z.string(), z.date()]);
    case 'multiple':
      return z.array(z.string());
    case 'link':
      return z.union([z.string(), z.object({ id: z.string() })]);
    default:
      return z.unknown();
  }
}
