/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises */

import { test } from 'vitest';
import { XataRecord } from './record';
import { SelectableColumn, SelectedPick, ValueAtColumn } from './selection';

interface Team {
  name: string;
  labels?: string[] | null;
  owner?: UserRecord | null;
}

type TeamRecord = Team & XataRecord;

interface User {
  email?: string | null;
  full_name: string;
  address?: { street?: string | null; zipcode?: number | null } | null;
  team?: TeamRecord | null;
  date?: Date | null;
  partner: UserRecord;
  settings?: {
    theme?: 'light' | 'dark';
    language?: 'en' | 'de' | 'fr';
    signin?: {
      email?: string | null;
      github?: string | null;
    };
  } | null;
  nonNullable: {
    nested: {
      value: number;
      deep: {
        depths: {
          of: {
            numbers: number[];
          };
        };
      };
    };
  };
}

type UserRecord = User & XataRecord;

//                              SelectableColumn<O>                            //
// --------------------------------------------------------------------------- //

const validTeamColumns: SelectableColumn<TeamRecord>[] = [
  '*',
  'id',
  'name',
  'owner.*',
  'owner.address.*',
  'owner.address',
  'owner.address.street',
  'owner.date'
];

// @ts-expect-error
const invalidFullNameTeamColumn: SelectableColumn<Team> = 'full_name';
// @ts-expect-error
const invalidPartialTeamColumn: SelectableColumn<Team> = 'owner.address.';
// @ts-expect-error
const invalidDeleteTeamColumn: SelectableColumn<Team> = 'owner.delete';
// @ts-expect-error
const invalidReadTeamColumn: SelectableColumn<Team> = 'owner.read.*';
// @ts-expect-error
const invalidInternalDateColumns: SelectableColumn<Team> = 'owner.date.getFullYear';

//                              ValueAtColumn<O, P>                            //
// --------------------------------------------------------------------------- //

const labelsValue: ValueAtColumn<TeamRecord, 'labels'> = ['foo'];
// @ts-expect-error
const invalidLabelsValue: ValueAtColumn<TeamRecord, 'labels'> = [1];

//                            SelectedRecordPick<O, Key>                        //
// ---------------------------------------------------------------------------- //

function test1(user: SelectedPick<UserRecord, ['*']>) {
  user.id;
  user.read();
  user.full_name;
  user.address?.street;

  // @ts-expect-error
  user.team.id;
  user.team?.id;
  user.team?.read();
  // @ts-expect-error
  user.team?.name;

  user.partner.id;
  user.partner.read();
  // @ts-expect-error
  user.partner.full_name;

  user.team = null;
  // @ts-expect-error
  user.partner = null;
}

function test2(user: SelectedPick<UserRecord, ['*', 'team.*']>) {
  user.id;
  user.read();
  user.full_name;
  user.team?.id;
  user.team?.read();
  user.team?.name;
  user.team?.owner;
  user.team?.owner?.id;
  user.team?.owner?.read();
  // @ts-expect-error
  user.team?.owner?.full_name;

  // @ts-expect-error
  user.full_name = null;
  user.email = null;
  user.email = '';
  // @ts-expect-error
  user.email = 2;
  if (user.team) {
    // @ts-expect-error
    user.team.name = null;
    user.team.labels = null;
    user.team.labels = ['foo'];
    // @ts-expect-error
    user.team.labels = [1];
  }
}

function test3(user: SelectedPick<UserRecord, ['team.owner.*']>) {
  user.id;
  user.read();
  // @ts-expect-error
  user.full_name;
  user.team?.id;
  user.team?.read();
  // @ts-expect-error
  user.team?.name;
  user.team?.owner?.id;
  user.team?.owner?.read();
  user.team?.owner?.full_name;
}

function test4(user: SelectedPick<UserRecord, ['team.owner.address']>) {
  user.id;
  user.read();
  // @ts-expect-error
  user.full_name;
  user.team?.id;
  user.team?.read();
  // @ts-expect-error
  user.team?.name;
  user.team?.owner?.id;
  user.team?.owner?.read();
  // @ts-expect-error
  user.team?.owner?.full_name;
  user.team?.owner?.address;
  user.team?.owner?.address?.street;
  user.team?.owner?.address?.zipcode;
}

function test5(user: SelectedPick<UserRecord, ['settings', 'nonNullable']>) {
  user.id;
  user.read();
  // @ts-expect-error
  user.full_name;
  user.settings;
  user.settings?.theme;
  user.settings?.language;
  user.settings?.signin;
  user.settings?.signin?.email;
  user.settings?.signin?.github;
  // @ts-expect-error
  user.settings?.id;
  // @ts-expect-error
  user.settings?.read();
  // @ts-expect-error
  user.settings?.signin?.id;
  user.settings = null;
  user.nonNullable.nested.value = 2;
  // @ts-expect-error
  user.nonNullable = null;
  // @ts-expect-error
  user.nonNullable.nested.value = null;
}

function test6(user: SelectedPick<UserRecord, ['settings.*', 'nonNullable.*']>) {
  user.id;
  user.read();
  // @ts-expect-error
  user.full_name;
  user.settings;
  user.settings?.theme;
  user.settings?.language;
  user.settings?.signin;
  user.settings?.signin?.email;
  user.settings?.signin?.github;
  // @ts-expect-error
  user.settings?.id;
  // @ts-expect-error
  user.settings?.read();
  // @ts-expect-error
  user.settings?.signin?.id;
  user.nonNullable.nested.value = 2;
  user.nonNullable.nested.deep.depths.of.numbers = [1, 2, 3];
  // @ts-expect-error
  user.nonNullable.nested.deep.depths.of.numbers = 'invalid-string';

  user.settings = null;
  // @ts-expect-error
  user.nonNullable = null;
  // @ts-expect-error
  user.nonNullable.nested.value = null;
}

function test7(user: SelectedPick<UserRecord, ['partner', 'team']>) {
  user.partner;
  user.partner.id;
  user.partner.read();
  user.partner.full_name;
  // @ts-expect-error
  user.partner.full_name = null;
  user.partner.address;
  // @ts-expect-error
  user.team.id;
  user.team?.id;
  // @ts-expect-error
  user.team.read();
  user.team?.read();

  // @ts-expect-error
  user.partner = null;
  user.team = null;
}

function test8(user: SelectedPick<UserRecord, ['partner.*', 'team.*']>) {
  user.partner;
  user.partner.id;
  user.partner.read();
  user.partner.full_name;
  // @ts-expect-error
  user.partner.full_name = null;
  user.partner.address;
  // @ts-expect-error
  user.team.id;
  user.team?.id;
  // @ts-expect-error
  user.team.read();
  user.team?.read();

  // @ts-expect-error
  user.partner = null;
  user.team = null;
}

test('fake test', () => {
  // This is a fake test to make sure that the type definitions in this file are working
});
