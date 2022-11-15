import { XataApiClient } from '../../../packages/client/src';
import { XataClient } from '../../../packages/codegen/example/xata';
import { isObject } from '../shared';

async function handleResponse() {
  const region = process.env.XATA_REGION || 'eu-west-1';

  const workspace = process.env.XATA_WORKSPACE;
  if (!workspace) throw new Error('XATA_WORKSPACE environment variable is not set');

  const api = new XataApiClient({ apiKey: process.env.XATA_API_KEY });

  const id = Math.round(Math.random() * 100000);

  const { databaseName: database } = await api.database.createDatabase({
    workspace,
    database: `sdk-e2e-test-${id}`,
    data: { region }
  });

  await api.tables.createTable({ workspace, database, region, branch: 'main', table: 'teams' });
  await api.tables.createTable({ workspace, database, region, branch: 'main', table: 'users' });
  await api.tables.setTableSchema({
    workspace,
    database,
    region,
    branch: 'main',
    table: 'teams',
    schema: { columns: teamColumns }
  });
  await api.tables.setTableSchema({
    workspace,
    database,
    region,
    branch: 'main',
    table: 'users',
    schema: { columns: userColumns }
  });

  const xata = new XataClient({
    databaseURL: `https://${workspace}.${region}.xata.sh/db/${database}`,
    branch: 'main'
  });

  const team = await xata.db.teams.create({ name: 'Team 1' });
  await xata.db.users.create({ full_name: 'User 1', team });

  const users = await xata.db.users.getAll();
  const teams = await xata.db.teams.getAll();

  await api.database.deleteDatabase({ workspace, database });

  return { users, teams };
}

async function main() {
  // @ts-ignore
  const server = Bun.serve({
    async fetch() {
      const response = await handleResponse();

      return new Response(JSON.stringify(response));
    },
    port: 12345
  });

  const response = await fetch('http://localhost:12345');
  const body = await response.json();

  if (
    isObject(body) &&
    Array.isArray(body.users) &&
    Array.isArray(body.teams) &&
    body.users.length > 0 &&
    body.teams.length > 0
  ) {
    console.log('Successfully fetched data from bun http server');
  } else {
    throw new Error('Failed to fetch data from bun http server');
  }

  server.stop();
}

const userColumns: any[] = [
  {
    name: 'email',
    type: 'email'
  },
  {
    name: 'full_name',
    type: 'string'
  },
  {
    name: 'address',
    type: 'object',
    columns: [
      {
        name: 'street',
        type: 'string'
      },
      {
        name: 'zipcode',
        type: 'int'
      }
    ]
  },
  {
    name: 'team',
    type: 'link',
    link: {
      table: 'teams'
    }
  }
];

const teamColumns: any[] = [
  {
    name: 'name',
    type: 'string'
  },
  {
    name: 'labels',
    type: 'multiple'
  },
  {
    name: 'owner',
    type: 'link',
    link: {
      table: 'users'
    }
  }
];

main();
