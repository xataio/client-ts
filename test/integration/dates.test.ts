import fetch from 'cross-fetch';
import dotenv from 'dotenv';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { BaseClientOptions, buildClient, XataApiClient } from '../../packages/client/src';
import { Column } from '../../packages/client/src/api/schemas';

// Get environment variables before reading them
dotenv.config({ path: join(process.cwd(), '.envrc') });

interface DateTime {
  text?: string | null;
  date?: Date | null;
}

type DatabaseSchema = {
  datetime: DateTime;
};

const DatabaseClient = buildClient();

class XataClient extends DatabaseClient<DatabaseSchema> {
  constructor(options?: BaseClientOptions) {
    super(options, {});
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

    expect(typeof record.date).toEqual('object');
    expect(record.date?.toISOString()).toEqual(date.toISOString());
  });
});
