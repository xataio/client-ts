// Generated by Xata Codegen 0.18.0. Please do not edit.
import { BaseClientOptions, buildClient, SchemaInference, XataRecord } from '../../client/src';

const tables = [
  {
    name: 'teams',
    columns: [
      { name: 'name', type: 'string' },
      { name: 'description', type: 'text' },
      { name: 'index', type: 'int' },
      { name: 'rating', type: 'float' },
      { name: 'founded_date', type: 'datetime' },
      { name: 'email', type: 'email' },
      {
        name: 'settings',
        type: 'object',
        columns: [
          { name: 'plan', type: 'string' },
          { name: 'dark', type: 'bool' },
          { name: 'labels', type: 'multiple' }
        ]
      },
      { name: 'owner', type: 'link', link: { table: 'users' } }
    ]
  },
  {
    name: 'users',
    columns: [
      { name: 'email', type: 'email', unique: true },
      { name: 'full_name', type: 'string', notNull: true },
      { name: 'birthDate', type: 'datetime' },
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
export type InferredTypes = SchemaInference<SchemaTables>;

export type Teams = InferredTypes['teams'];
export type TeamsRecord = Teams & XataRecord;

export type Users = InferredTypes['users'];
export type UsersRecord = Users & XataRecord;

export type DatabaseSchema = {
  teams: TeamsRecord;
  users: UsersRecord;
};

const DatabaseClient = buildClient();

const defaultOptions = { databaseURL: 'https://test-r5vcv5.xata.sh/db/test' };

export class XataClient extends DatabaseClient<DatabaseSchema> {
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
