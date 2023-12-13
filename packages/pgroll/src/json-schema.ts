import { migration } from './migration';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { operations } from './operations';

export function generateJSONSchema(options: { operationsOnly: boolean } = { operationsOnly: false }) {
  if (options.operationsOnly) {
    return zodToJsonSchema(operations, 'Operations');
  }
  return zodToJsonSchema(migration, 'Migration');
}
