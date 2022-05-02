/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises */

import { XataRecord } from './record';
import { SelectableColumn, SelectedPick, ValueAtColumn } from './selection';

interface Team {
  name?: string | null;
  labels?: string[] | null;
  owner?: UserRecord | null;
}

type TeamRecord = Team & XataRecord;

interface User {
  email?: string | null;
  full_name?: string | null;
  address?: { street?: string | null; zipcode?: number | null } | null;
  team?: TeamRecord | null;
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
  'owner.address.street'
];

// @ts-expect-error
const invalidFullNameTeamColumn: SelectableColumn<Team> = 'full_name';
// @ts-expect-error
const invalidPartialTeamColumn: SelectableColumn<Team> = 'owner.address.';
// @ts-expect-error
const invalidDeleteTeamColumn: SelectableColumn<Team> = 'owner.delete';
// @ts-expect-error
const invalidReadTeamColumn: SelectableColumn<Team> = 'owner.read.*';

//                              ValueAtColumn<O, P>                            //
// --------------------------------------------------------------------------- //

const labelsValue: ValueAtColumn<TeamRecord, 'labels'> = ['foo'];
// @ts-expect-error
const invalidLabelsValue: ValueAtColumn<TeamRecord, 'labels'> = [1];

//                            SelectedRecordPick<O, Key>                        //
// ---------------------------------------------------------------------------- //

function selectedRecordPickTest1(selectedUserBaseRecord: SelectedPick<UserRecord, ['*']>) {
  selectedUserBaseRecord.id;
  selectedUserBaseRecord.read();
  selectedUserBaseRecord.full_name;
  selectedUserBaseRecord.address?.street;
  selectedUserBaseRecord.team?.id;
  selectedUserBaseRecord.team?.read();
  // @ts-expect-error
  selectedUserBaseRecord.team?.name;
  selectedUserBaseRecord;
}

function selectedRecordPickTest2(selectedUserFullRecord: SelectedPick<UserRecord, ['*', 'team.*']>) {
  selectedUserFullRecord.id;
  selectedUserFullRecord.read();
  selectedUserFullRecord.full_name;
  selectedUserFullRecord.team?.id;
  selectedUserFullRecord.team?.read();
  selectedUserFullRecord.team?.name;
  selectedUserFullRecord.team?.owner;
  selectedUserFullRecord.team?.owner?.id;
  selectedUserFullRecord.team?.owner?.read();
  // @ts-expect-error
  selectedUserFullRecord.team?.owner?.full_name;
}

function selectedRecordPickTest3(selectedUserNestedRecord: SelectedPick<UserRecord, ['team.owner.*']>) {
  selectedUserNestedRecord.id;
  selectedUserNestedRecord.read();
  // @ts-expect-error
  selectedUserNestedRecord.full_name;
  selectedUserNestedRecord.team?.id;
  selectedUserNestedRecord.team?.read();
  // @ts-expect-error
  selectedUserNestedRecord.team?.name;
  selectedUserNestedRecord.team?.owner?.id;
  selectedUserNestedRecord.team?.owner?.read();
  selectedUserNestedRecord.team?.owner?.full_name;
}

function selectedRecordPickTest4(selectedUserNestedRecord: SelectedPick<UserRecord, ['team.owner.address']>) {
  selectedUserNestedRecord.id;
  selectedUserNestedRecord.read();
  // @ts-expect-error
  selectedUserNestedRecord.full_name;
  selectedUserNestedRecord.team?.id;
  selectedUserNestedRecord.team?.read();
  // @ts-expect-error
  selectedUserNestedRecord.team?.name;
  selectedUserNestedRecord.team?.owner?.id;
  selectedUserNestedRecord.team?.owner?.read();
  // @ts-expect-error
  selectedUserNestedRecord.team?.owner?.full_name;
  selectedUserNestedRecord.team?.owner?.address;
  selectedUserNestedRecord.team?.owner?.address?.street;
  selectedUserNestedRecord.team?.owner?.address?.zipcode;
}

test('fake test', () => {
  // This is a fake test to make sure that the type definitions in this file are working
});
