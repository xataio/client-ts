import { z } from 'zod';

// We need to do this because of problems with Zod and recursive types https://www.npmjs.com/package/zod#recursive-types
export type Column = {
  name: string;
  type: string;
  unique?: boolean;
  notNull?: boolean;
  defaultValue?: string;
  description?: string;
  link?: {
    table: string;
  };
  vector?: {
    dimension: number;
  };
  file?: {
    defaultPublicAccess?: boolean;
  };
  'file[]'?: {
    defaultPublicAccess?: boolean;
  };
  columns?: Column[];
};

export const columnSchema: z.ZodSchema<Column> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: z.string(),
    unique: z.boolean().optional(),
    notNull: z.boolean().optional(),
    defaultValue: z.string().optional(),
    description: z.string().optional(),
    link: z
      .object({
        table: z.string()
      })
      .optional(),
    vector: z
      .object({
        dimension: z.number()
      })
      .optional(),
    file: z
      .object({
        defaultPublicAccess: z.boolean().optional()
      })
      .optional(),
    'file[]': z
      .object({
        defaultPublicAccess: z.boolean().optional()
      })
      .optional(),
    columns: z.array(columnSchema).optional()
  })
);

export const revlinkSchema = z.object({
  table: z.string(),
  column: z.string()
});

export const tableSchema = z.object({
  name: z.string(),
  columns: z.array(columnSchema),
  primaryKey: z.array(z.string()).optional(),
  revLinks: z.array(revlinkSchema).optional()
});

export type Table = z.infer<typeof tableSchema>;

export const xataDatabaseSchema = z.object({
  tables: z.array(tableSchema)
});

export type XataDatabaseSchema = z.infer<typeof xataDatabaseSchema>;

export const parseSchemaFile = (input: string) => {
  return xataDatabaseSchema.safeParse(JSON.parse(input));
};
