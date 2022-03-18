import { z } from 'zod';

// We need to do this because of problems with Zod and recursive types https://www.npmjs.com/package/zod#recursive-types
export type Column = {
  name: string;
  type: 'bool' | 'int' | 'string' | 'text' | 'email' | 'multiple' | 'link' | 'object';
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
    type: z.enum(['bool', 'int', 'string', 'text', 'email', 'multiple', 'link', 'object']),
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
