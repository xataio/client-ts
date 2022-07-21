import fetch from 'cross-fetch';
import dotenv from 'dotenv';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { BaseClientOptions, buildClient, SchemaInference, XataApiClient } from '../../packages/client/src';
import { Column } from '../../packages/client/src/api/schemas';

// Get environment variables before reading them
dotenv.config({ path: join(process.cwd(), '.env') });

const DatabaseClient = buildClient();

const tables = [
  {
    name: 'datetime',
    columns: [
      { name: 'text', type: 'string' },
      { name: 'date', type: 'datetime' }
    ]
  }
] as const;

export type SchemaTables = typeof tables;
export type DatabaseSchema = SchemaInference<SchemaTables>;

class XataClient extends DatabaseClient<SchemaTables> {
  constructor(options?: BaseClientOptions) {
    super(options, tables);
  }
}

let xata: XataClient;
let databaseName: string;

const workspace = process.env.XATA_WORKSPACE ?? '';
if (workspace === '') throw new Error('XATA_WORKSPACE environment variable is not set');

const api = new XataApiClient({
  apiKey: process.env.XATA_API_KEY || '',
  fetch
});

const columns: Column[] = [
  {
    name: 'text',
    type: 'string'
  },
  {
    name: 'date',
    type: 'datetime'
  }
];

beforeAll(async () => {
  const id = Math.round(Math.random() * 100000);

  const database = await api.databases.createDatabase(workspace, `sdk-integration-test-dates-${id}`);
  databaseName = database.databaseName;

  xata = new XataClient({
    databaseURL: `https://${workspace}.xata.sh/db/${database.databaseName}`,
    branch: 'main',
    apiKey: process.env.XATA_API_KEY || '',
    fetch
  });

  await api.tables.createTable(workspace, databaseName, 'main', 'datetime');
  await api.tables.setTableSchema(workspace, databaseName, 'main', 'datetime', { columns });
});

afterAll(async () => {
  await api.databases.deleteDatabase(workspace, databaseName);
});

describe('dates', () => {
  test('add a record with a date', async () => {
    const date = new Date();
    const record = await xata.db.datetime.create({ date });

    expect(record.date instanceof Date).toEqual(true);
    expect(record.date?.toISOString()).toEqual(date.toISOString());
  });

  test('add a record without a date (optional)', async () => {
    const record = await xata.db.datetime.create({});

    expect(record.date).toBeUndefined();
  });
});
