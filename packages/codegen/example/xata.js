import { buildClient } from '../../client/src';
const tables = [
  {
    name: 'teams',
    columns: [
      {
        name: 'name',
        type: 'string',
        unique: true,
        description: 'Name of the team'
      },
      { name: 'labels', type: 'multiple' },
      { name: 'owner', type: 'link', link: { table: 'users' } }
    ]
  },
  {
    name: 'users',
    columns: [
      { name: 'email', type: 'email' },
      { name: 'full_name', type: 'string' },
      {
        name: 'address',
        type: 'object',
        columns: [
          { name: 'street', type: 'string' },
          { name: 'zipcode', type: 'int' }
        ]
      },
      { name: 'team', type: 'link', link: { table: 'teams' } }
    ]
  }
];
const DatabaseClient = buildClient();
export class XataClient extends DatabaseClient {
  constructor(options) {
    super(tables, {
      databaseURL: 'https://test-r5vcv5.xata.sh/db/test',
      ...options
    });
  }
}
