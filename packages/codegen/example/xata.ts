import { BaseClientOptions, buildClient, SchemaInference } from '../../client/src';

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
] as const;

export type DatabaseSchema = SchemaInference<typeof tables>;

export type TeamRecord = DatabaseSchema['teams'];
export type UserRecord = DatabaseSchema['users'];

const DatabaseClient = buildClient();

export class XataClient extends DatabaseClient<typeof tables> {
  constructor(options?: BaseClientOptions) {
    super(tables, {
      databaseURL: 'https://test-r5vcv5.xata.sh/db/test',
      ...options
    });
  }
}
