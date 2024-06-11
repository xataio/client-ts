import { buildClient, getDeployPreviewBranch } from '../../client/src';
import type { BaseClientOptions, SchemaInference, XataRecord } from '../../client/src';

const schema = {
  tables: [
    {
      name: 'teams',
      primaryKey: ['xata_id'],
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
      primaryKey: ['xata_id'],
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
      primaryKey: [],
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
    },
    {
      name: 'numeric',
      primaryKey: ['xata_id'],
      columns: [
        { name: 'xata_id', type: 'int', notNull: true },
        { name: 'xata_version', type: 'int', notNull: true },
        { name: 'xata_createdat', type: 'datetime', notNull: true },
        { name: 'xata_updatedat', type: 'datetime', notNull: true }
      ]
    }
  ]
} as const;

export type SchemaTables = typeof schema.tables;
export type InferredTypes = SchemaInference<SchemaTables>;

export type Teams = InferredTypes['teams'];
export type TeamsRecord = Teams & XataRecord;

export type Users = InferredTypes['users'];
export type UsersRecord = Users & XataRecord;

export type Pets = InferredTypes['pets'];
export type PetsRecord = Pets & XataRecord;

export type Numeric = InferredTypes['numeric'];
export type NumericRecord = Numeric & XataRecord;

export type DatabaseSchema = {
  teams: TeamsRecord;
  users: UsersRecord;
  pets: PetsRecord;
  numeric: NumericRecord;
};

const DatabaseClient = buildClient();

export class XataClient extends DatabaseClient<typeof schema> {
  constructor(options?: BaseClientOptions) {
    super(
      {
        apiKey: process.env.XATA_API_KEY,
        databaseURL: process.env.XATA_DATABASE_URL,
        // Use deploy preview branch if available, otherwise use branch from environment
        branch: getDeployPreviewBranch(process.env) ?? process.env.XATA_BRANCH ?? 'main',
        ...options
      },
      schema
    );
  }
}
