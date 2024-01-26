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
      { name: 'team', type: 'link', link: { table: 'teams' } },
      { name: 'json', type: 'json' }
    ]
  }
] as const;

function simpleTeam(team: SchemaInference<typeof tables>['teams'] & XataRecord) {
  team.getMetadata();
  team.owner?.getMetadata();
}

function simpleUser(user: SchemaInference<typeof tables>['users'] & XataRecord) {
  user.full_name.startsWith('a');

  user.getMetadata();
  user.team?.getMetadata();

  user.json?.foo;
  user.json?.[0];
}

test('fake test', () => {
  // This is a fake test to make sure that the type definitions in this file are working
});
