import { z } from 'zod';
import { handleParsingError } from './errors.js';

// We need to do this because of problems with Zod and recursive types https://www.npmjs.com/package/zod#recursive-types
export type Column = {
  name: string;
  type: 'bool' | 'int' | 'float' | 'string' | 'text' | 'email' | 'multiple' | 'link' | 'object';
  unique?: boolean;
  description?: string;
  link?: {
    table: string;
  };
  columns?: Column[];
};

export const columnSchema: z.ZodSchema<Column> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: z.enum(['bool', 'int', 'float', 'string', 'text', 'email', 'multiple', 'link', 'object']),
    unique: z.boolean().optional(),
    description: z.string().optional(),
    link: z
      .object({
        table: z.string()
      })
      .optional(),
    columns: z.array(columnSchema).optional()
  })
);

export const tableSchema = z.object({
  name: z.string(),
  columns: z.array(columnSchema)
});

export type Table = z.infer<typeof tableSchema>;

export const xataDatabaseSchema = z.object({
  formatVersion: z.literal('1.0'),
  tables: z.array(tableSchema)
});

export type XataDatabaseSchema = z.infer<typeof xataDatabaseSchema>;

export const parseSchemaFile = (input: string) => {
  try {
    return xataDatabaseSchema.parse(JSON.parse(input));
  } catch (err) {
    handleParsingError(err);
    throw err; // ^ runs process.exit(1) if not successful. If not, let's throw the error because if we don't, then this function would return its type | undefined and we'd have to optionally chain and account for potential undefined returns wherever we use it.
  }
};
