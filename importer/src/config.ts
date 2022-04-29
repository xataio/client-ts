// Same as codegen/src/config.ts
import { z } from 'zod';

export const xataConfigSchema = z.object({
  schemaFileFormat: z.literal('json'),
  dbName: z.string(),
  workspaceID: z.string()
});

export type XataConfigSchema = z.infer<typeof xataConfigSchema>;

export const parseConfigFile = (input: string) => {
  return xataConfigSchema.parse(JSON.parse(input));
};
