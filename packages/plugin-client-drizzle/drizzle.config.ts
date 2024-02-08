import 'dotenv/config';
import type { Config } from 'drizzle-kit';
export default {
  schema: './test/schema.ts',
  out: './test/migrations',
  driver: 'pg'
} satisfies Config;
