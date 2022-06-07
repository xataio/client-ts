// @ts-ignore
import { XataApiClient, BaseClient } from '@xata.io/client';

export default {
  async fetch(_request: Request, env: Record<string, string>): Promise<Response> {
    const { XATA_WORKSPACE: workspace, XATA_API_KEY: apiKey } = env;

    const api = new XataApiClient({ apiKey });

    const id = Math.round(Math.random() * 100000);

    const { databaseName } = await api.databases.createDatabase(workspace, `sdk-e2e-test-${id}`);

    await api.tables.createTable(workspace, databaseName, 'main', 'teams');
    await api.tables.createTable(workspace, databaseName, 'main', 'users');
    await api.tables.setTableSchema(workspace, databaseName, 'main', 'teams', { columns: teamColumns });
    await api.tables.setTableSchema(workspace, databaseName, 'main', 'users', { columns: userColumns });

    const xata = new BaseClient({
      databaseURL: `https://${workspace}.xata.sh/db/${databaseName}`,
      branch: 'main',
      apiKey
    });

    const team = await xata.db.teams.create({ name: 'Team 1' });
    await xata.db.users.create({ full_name: 'User 1', team });

    const users = await xata.db.users.getMany();
    const teams = await xata.db.teams.getMany();

    await api.databases.deleteDatabase(workspace, databaseName);

    return new Response(JSON.stringify({ users, teams }));
  }
};

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
