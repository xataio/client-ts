import { generateJSONSchema } from '../src';
import fs from 'fs';

const jsonSchema = generateJSONSchema();
fs.writeFileSync('pgroll.schema.json', JSON.stringify(jsonSchema, null, 2));
