/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises */

import { test } from 'vitest';
import { XataRecord } from '../api/schemas';
import { SchemaInference } from './inference';

const tables = [
  {
    name: 'teams',
    columns: [
      { name: 'name', type: 'string' },
      { name: 'labels', type: 'multiple' },
      { name: 'owner', type: 'link', link: { table: 'users' } }
    ]
  },
  {
    name: 'users',
    columns: [
      { name: 'email', type: 'email' },
      { name: 'full_name', type: 'string', notNull: true, defaultValue: 'John Doe' },
      {
        name: 'address',
        type: 'object',
        columns: [
          { name: 'street', type: 'string' },
          { name: 'zipcode', type: 'int' }
        ]
      },
      { name: 'team', type: 'link', link: { table: 'teams' } },
      { name: 'json', type: 'json' }
    ]
  }
] as const;

function simpleTeam(team: SchemaInference<typeof tables>['teams'] & XataRecord) {
  team.owner?.address?.zipcode;
  team.owner?.address?.zipcode?.toString();

  team.getMetadata();
  team.owner?.getMetadata();
}

function simpleUser(user: SchemaInference<typeof tables>['users'] & XataRecord) {
  user.full_name.startsWith('a');

  user.address?.zipcode;
  user.address?.zipcode?.toString();

  user.getMetadata();
  user.team?.getMetadata();

  user.address = { street: '' };
  // @ts-expect-error
  user.address = '';

  user.json?.foo;
  user.json?.[0];
}

test('fake test', () => {
  // This is a fake test to make sure that the type definitions in this file are working
});
