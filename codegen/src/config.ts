import { z } from 'zod';

export const xataConfigSchema = z.object({
  schemaFileFormat: z.literal('json'),
  dbName: z.string(),
  workspaceID: z.string()
});

export type XataConfigSchema = z.infer<typeof xataConfigSchema>;
