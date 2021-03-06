import { BaseClientOptions, buildClient, SchemaInference, XataRecord } from '../../client/src';

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

export type SchemaTables = typeof tables;
export type DatabaseSchema = SchemaInference<SchemaTables>;

export type Teams = DatabaseSchema['teams'];
export type TeamsRecord = Teams & XataRecord;

export type Users = DatabaseSchema['users'];
export type UsersRecord = Users & XataRecord;

const DatabaseClient = buildClient();

const defaultOptions = { databaseURL: 'https://test-r5vcv5.xata.sh/db/test' };

export class XataClient extends DatabaseClient<SchemaTables> {
  constructor(options?: BaseClientOptions) {
    super({ ...defaultOptions, ...options }, tables);
  }
}

let instance: XataClient | undefined = undefined;
export const getXataClient = () => {
  if (instance) return instance;

  instance = new XataClient();
  return instance;
};
