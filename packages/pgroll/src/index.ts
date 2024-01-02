import { schema } from './schema';

export * from './types';

export const PGROLL_JSON_SCHEMA_URL = 'https://raw.githubusercontent.com/xataio/pgroll/main/schema.json';

// In the future, we can use this function to generate the JSON schema tailored to the user's data model.
export function generateJSONSchema() {
  return schema;
}
