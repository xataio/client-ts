import { buildClient, getDeployPreviewBranch } from '../../client/src';
import type { BaseClientOptions, SchemaInference, XataRecord } from '../../client/src';

const tables = [
  {
    name: 'teams',
    columns: [
      { name: 'xata_id', type: 'string', notNull: true },
      { name: 'xata_version', type: 'int', notNull: true },
      { name: 'xata_createdat', type: 'datetime', notNull: true },
      { name: 'xata_updatedat', type: 'datetime', notNull: true },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'text' },
      { name: 'labels', type: 'multiple' },
      { name: 'index', type: 'int' },
      { name: 'rating', type: 'float' },
      { name: 'founded_date', type: 'datetime' },
      { name: 'email', type: 'email' },
      { name: 'plan', type: 'string' },
      { name: 'dark', type: 'bool' },
      { name: 'config', type: 'json' },
      { name: 'owner', type: 'link', link: { table: 'users' } }
    ],
    revLinks: [{ table: 'users', column: 'team' }]
  },
  {
    name: 'users',
    columns: [
      { name: 'xata_id', type: 'string', notNull: true },
      { name: 'xata_version', type: 'int', notNull: true },
      { name: 'xata_createdat', type: 'datetime', notNull: true },
      { name: 'xata_updatedat', type: 'datetime', notNull: true },
      { name: 'email', type: 'email', unique: true },
      { name: 'name', type: 'string' },
      { name: 'photo', type: 'file', file: { defaultPublicAccess: true } },
      { name: 'attachments', type: 'file[]' },
      { name: 'plan', type: 'string' },
      { name: 'dark', type: 'bool' },
      {
        name: 'full_name',
        type: 'string',
        notNull: true,
        defaultValue: 'John Doe'
      },
      { name: 'index', type: 'int' },
      { name: 'rating', type: 'float' },
      { name: 'birthDate', type: 'datetime' },
      { name: 'street', type: 'string' },
      { name: 'zipcode', type: 'int' },
      { name: 'team', type: 'link', link: { table: 'teams' } },
      { name: 'pet', type: 'link', link: { table: 'pets' } },
      { name: 'account_value', type: 'int' },
      { name: 'vector', type: 'vector', vector: { dimension: 4 } }
    ],
    revLinks: [{ table: 'teams', column: 'owner' }]
  },
  {
    name: 'pets',
    columns: [
      { name: 'xata_id', type: 'string', notNull: true },
      { name: 'xata_version', type: 'int', notNull: true },
      { name: 'xata_createdat', type: 'datetime', notNull: true },
      { name: 'xata_updatedat', type: 'datetime', notNull: true },
      { name: 'name', type: 'string' },
      { name: 'type', type: 'string' },
      { name: 'num_legs', type: 'int' }
    ],
    revLinks: [{ table: 'users', column: 'pet' }]
  }
] as const;

export type SchemaTables = typeof tables;
export type InferredTypes = SchemaInference<SchemaTables>;
export type DatabaseSchema = {
  teams: TeamsRecord;
  users: UsersRecord;
  pets: PetsRecord;
};

const DatabaseClient = buildClient();

export class XataClient extends DatabaseClient<DatabaseSchema> {
  constructor(options?: BaseClientOptions) {
    super(
      {
        apiKey: process.env.XATA_API_KEY,
        databaseURL: process.env.XATA_DATABASE_URL,
        // Use deploy preview branch if available, otherwise use branch from environment
        branch: getDeployPreviewBranch(process.env) ?? process.env.XATA_BRANCH ?? 'main',
        ...options
      },
      tables
    );
  }
}

export type Teams = InferredTypes['teams'];
export type TeamsRecord = Teams & XataRecord;

export type Users = InferredTypes['users'];
export type UsersRecord = Users & XataRecord;

export type Pets = InferredTypes['pets'];
export type PetsRecord = Pets & XataRecord;
