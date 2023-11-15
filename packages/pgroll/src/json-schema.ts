import { migration } from './migration';
import { zodToJsonSchema } from 'zod-to-json-schema';

export function generateJSONSchema() {
  return zodToJsonSchema(migration, 'Migration');
}
