import { XataApiClient } from '../../../packages/client/src';
import { XataClient } from '../../../packages/codegen/example/xata';
import { teamColumns, userColumns } from '../../mock_data';

async function main() {
  const workspace = process.env.XATA_WORKSPACE;

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

// @ts-ignore
Bun.serve({
  async fetch() {
    const response = await main();

    return new Response(JSON.stringify(response));
  },
  port: 12345
});
