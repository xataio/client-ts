import { XataApiClient } from '../../../packages/client/src';
import { XataClient } from '../../../packages/codegen/example/xata';
import { teamColumns, userColumns } from '../../mock_data';
import { isObject } from '../shared';

async function handleResponse() {
  const workspace = process.env.XATA_WORKSPACE;
  if (!workspace) throw new Error('XATA_WORKSPACE environment variable is not set');

  const api = new XataApiClient({ apiKey: process.env.XATA_API_KEY });

  const id = Math.round(Math.random() * 100000);

  const { databaseName } = await api.databases.createDatabase(workspace, `sdk-e2e-test-${id}`);

  await api.tables.createTable(workspace, databaseName, 'main', 'teams');
  await api.tables.createTable(workspace, databaseName, 'main', 'users');
  await api.tables.setTableSchema(workspace, databaseName, 'main', 'teams', { columns: teamColumns });
  await api.tables.setTableSchema(workspace, databaseName, 'main', 'users', { columns: userColumns });

  const xata = new XataClient({
    databaseURL: `https://${workspace}.xata.sh/db/${databaseName}`,
    branch: 'main',
    apiKey: process.env.XATA_API_KEY
  });

  const team = await xata.db.teams.create({ name: 'Team 1' });
  await xata.db.users.create({ full_name: 'User 1', team });

  const users = await xata.db.users.getAll();
  const teams = await xata.db.teams.getAll();

  await api.databases.deleteDatabase(workspace, databaseName);

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

main();
