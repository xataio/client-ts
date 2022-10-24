import type { NextApiRequest, NextApiResponse } from 'next';
// @ts-ignore
import { XataApiClient, BaseClient } from '@xata.io/client';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const { XATA_WORKSPACE: workspace, XATA_API_KEY: apiKey, XATA_REGION: region = 'eu-west-1' } = process.env;
  if (!workspace || !apiKey) {
    throw new Error('XATA_WORKSPACE and XATA_API_KEY are required');
  }

  const api = new XataApiClient({ apiKey });

  const id = Math.round(Math.random() * 100000);

  const { databaseName } = await api.database.createDatabase(workspace, `sdk-e2e-test-${id}`, { region });

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

  const users = await xata.db.users.getAll();
  const teams = await xata.db.teams.getAll();

  await api.database.deleteDatabase(workspace, databaseName);

  res.status(200).json({ users, teams });
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
