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

function simpleTeam(team: SchemaInference<typeof tables>['teams'] & XataRecord) {
  team.owner?.address?.zipcode;
  team.owner?.address?.zipcode?.toString();

  team.getMetadata();
  team.owner?.getMetadata();
}

function simpleUser(user: SchemaInference<typeof tables>['users'] & XataRecord) {
  user.address?.zipcode;
  user.address?.zipcode?.toString();

  user.getMetadata();
  user.team?.getMetadata();

  user.address = { street: '' };
}

test('fake test', () => {
  // This is a fake test to make sure that the type definitions in this file are working
});
