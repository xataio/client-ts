import { describe, expect, test } from 'vitest';
import { BaseClient } from './client';
import { DatabaseSchema } from './schema';

const schema: DatabaseSchema = {
  tables: []
};

describe('BaseClient', () => {
  test('accepts and uses postgresConnectionString', () => {
    const postgresConnectionString = 'postgres://user:password@localhost:5432/mydb';
    const client = new BaseClient({ apiKey: 'fake-api-key', databaseURL: 'https://example.xata.sh/db', branch: 'main', postgresConnectionString }, schema);

    // @ts-ignore
    expect(client.#options.postgresConnectionString).toBe(postgresConnectionString);
  });
});
