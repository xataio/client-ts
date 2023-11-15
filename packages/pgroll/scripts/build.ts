import { migration } from '../src';
import { zodToJsonSchema } from 'zod-to-json-schema';
import fs from 'fs';

const jsonSchema = zodToJsonSchema(migration, 'Migration');
fs.writeFileSync('pgroll.schema.json', JSON.stringify(jsonSchema, null, 2));
