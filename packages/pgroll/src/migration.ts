import { z } from 'zod';
import { operation } from './operations';

export type Migration = z.infer<typeof migration>;

export const migration = z.object({
  name: z.string(),
  operations: z.array(operation)
});
