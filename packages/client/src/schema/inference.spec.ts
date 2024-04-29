/* eslint-disable @typescript-eslint/no-unused-vars */

import { test } from 'vitest';
import { XataRecord } from '../api/schemas';
import { SchemaInference } from './inference';

const tables = [
  {
    name: 'teams',
    columns: [
      { name: 'xata_id', type: 'string' },
      { name: 'xata_version', type: 'int' },
      { name: 'xata_createdat', type: 'datetime' },
      { name: 'xata_updatedat', type: 'datetime' },
      { name: 'name', type: 'string' },
      { name: 'labels', type: 'multiple' },
      { name: 'owner', type: 'link', link: { table: 'users' } }
    ]
  },
  {
    name: 'users',
    columns: [
      { name: 'xata_id', type: 'string' },
      { name: 'xata_version', type: 'int' },
      { name: 'xata_createdat', type: 'datetime' },
      { name: 'xata_updatedat', type: 'datetime' },
      { name: 'email', type: 'email' },
      { name: 'full_name', type: 'string', notNull: true, defaultValue: 'John Doe' },
      { name: 'team', type: 'link', link: { table: 'teams' } },
      { name: 'json', type: 'json' }
    ]
  }
] as const;

function simpleUser(user: SchemaInference<typeof tables>['users'] & XataRecord) {
  user.full_name.startsWith('a');

  user.json?.foo;
  user.json?.[0];
}

test('fake test', () => {
  // This is a fake test to make sure that the type definitions in this file are working
});
