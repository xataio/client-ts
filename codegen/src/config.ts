import { z } from 'zod';
import { handleParsingError } from './errors.js';

export const xataConfigSchema = z.object({
  schemaFileFormat: z.literal('json'),
  dbName: z.string(),
  workspaceID: z.string()
});

export type XataConfigSchema = z.infer<typeof xataConfigSchema>;

export const parseConfigFile = (input: string) => {
  try {
    return xataConfigSchema.parse(JSON.parse(input));
  } catch (err) {
    handleParsingError(err);
    throw err; // ^ runs process.exit(1) if not successful. If not, let's throw the error because if we don't, then this function would return its type | undefined and we'd have to optionally chain and account for potential undefined returns wherever we use it.
  }
};
