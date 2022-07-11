/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises */

import { test } from 'vitest';
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

declare const team: SchemaInference<typeof tables>['teams'];

team.owner.address.zipcode;

test('fake test', () => {
  // This is a fake test to make sure that the type definitions in this file are working
});
