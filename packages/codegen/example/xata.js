// Generated by Xata Codegen 0.21.0. Please do not edit.
import { buildClient } from '../../client/src';
/** @typedef { import('./types').SchemaTables } SchemaTables */
/** @type { SchemaTables } */
const tables = [
  {
    name: 'teams',
    columns: [
      { name: 'name', type: 'string' },
      { name: 'description', type: 'text' },
      { name: 'labels', type: 'multiple' },
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
      { name: 'name', type: 'string' },
      {
        name: 'settings',
        type: 'object',
        columns: [
          { name: 'plan', type: 'string' },
          { name: 'dark', type: 'bool' },
          { name: 'labels', type: 'multiple' }
        ]
      },
      {
        name: 'full_name',
        type: 'string',
        notNull: true,
        defaultValue: 'John Doe'
      },
      { name: 'index', type: 'int' },
      { name: 'rating', type: 'float' },
      { name: 'birthDate', type: 'datetime' },
      {
        name: 'address',
        type: 'object',
        columns: [
          { name: 'street', type: 'string' },
          { name: 'zipcode', type: 'int' }
        ]
      },
      { name: 'team', type: 'link', link: { table: 'teams' } },
      { name: 'pet', type: 'link', link: { table: 'pets' } },
      { name: 'account_value', type: 'int' }
    ]
  },
  {
    name: 'pets',
    columns: [
      { name: 'name', type: 'string' },
      { name: 'type', type: 'string' },
      { name: 'num_legs', type: 'int' }
    ]
  }
];
/** @type { import('../../client/src').ClientConstructor<{}> } */
const DatabaseClient = buildClient();
const defaultOptions = {
  databaseURL: 'https://test-r5vcv5.eu-west-1.xata.sh/db/test'
};
/** @typedef { import('./types').DatabaseSchema } DatabaseSchema */
/** @extends DatabaseClient<DatabaseSchema> */
export class XataClient extends DatabaseClient {
  constructor(options) {
    super({ ...defaultOptions, ...options }, tables);
  }
}
let instance = undefined;
/** @type { () => XataClient } */
export const getXataClient = () => {
  if (instance) return instance;
  instance = new XataClient();
  return instance;
};
