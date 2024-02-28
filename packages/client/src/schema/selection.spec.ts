import { test } from 'vitest';
import { XataRecord } from './record';
import { SelectableColumn, SelectedPick, ValueAtColumn } from './selection';
import { XataFile } from './files';

interface Team {
  xata_id: string;
  xata_version: number;
  xata_createdat: Date;
  xata_updatedat: Date;
  name: string;
  labels?: string[] | null;
  owner?: UserRecord | null;
}

type TeamRecord = Team & XataRecord;

interface User {
  xata_id: string;
  xata_version: number;
  xata_createdat: Date;
  xata_updatedat: Date;
  email?: string | null;
  full_name: string;
  team?: TeamRecord | null;
  date?: Date | null;
  file?: XataFile | null;
  partner: UserRecord;
}

type UserRecord = User & XataRecord;

//                              SelectableColumn<O>                            //
// --------------------------------------------------------------------------- //

const validTeamColumns: SelectableColumn<TeamRecord>[] = ['*', 'xata_id', 'name', 'owner.*', 'owner.date'];

// @ts-expect-error
const invalidFullNameTeamColumn: SelectableColumn<Team> = 'full_name';
// @ts-expect-error
const invalidPartialTeamColumn: SelectableColumn<Team> = 'owner.full_name.';
// @ts-expect-error
const invalidDeleteTeamColumn: SelectableColumn<Team> = 'owner.delete';
// @ts-expect-error
const invalidReadTeamColumn: SelectableColumn<Team> = 'owner.read.*';
// @ts-expect-error
const invalidInternalDateColumns: SelectableColumn<Team> = 'owner.date.getFullYear';

// Internal columns
const internalVersionColumns: SelectableColumn<Team> = 'xata_version';
const internalCreatedAtColumns: SelectableColumn<Team> = 'xata_createdat';
const internalUpdatedAtColumns: SelectableColumn<Team> = 'xata_updatedat';
const linkVersionColumns: SelectableColumn<Team> = 'owner.xata_version';
const linkCreatedAtColumns: SelectableColumn<Team> = 'owner.xata_createdat';
const linkUpdatedAtColumns: SelectableColumn<Team> = 'owner.xata_updatedat';

//                              ValueAtColumn<O, P>                            //
// --------------------------------------------------------------------------- //

const labelsValue: ValueAtColumn<TeamRecord, 'labels'> = ['foo'];
// @ts-expect-error
const invalidLabelsValue: ValueAtColumn<TeamRecord, 'labels'> = [1];

//                            SelectedRecordPick<O, Key>                        //
// ---------------------------------------------------------------------------- //

function test1(user: SelectedPick<UserRecord, ['*']>) {
  user.xata_id;
  user.read();
  user.full_name;

  user.xata_version;
  user.xata_createdat;
  user.xata_updatedat;

  // @ts-expect-error
  user.team.xata_id;
  user.team?.xata_id;
  user.team?.read();
  // @ts-expect-error
  user.team?.name;

  user.partner.xata_id;
  user.partner.read();
  // @ts-expect-error
  user.partner.full_name;

  user.team = null;
  // @ts-expect-error
  user.partner = null;
}

function test2(user: SelectedPick<UserRecord, ['*', 'team.*']>) {
  user.xata_id;
  user.read();
  user.full_name;
  user.team?.xata_id;
  user.team?.read();
  user.team?.name;
  user.team?.owner;
  user.team?.owner?.xata_id;
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
  user.xata_id;
  user.read();
  // @ts-expect-error
  user.full_name;
  user.team?.xata_id;
  user.team?.read();
  // @ts-expect-error
  user.team?.name;
  user.team?.owner?.xata_id;
  user.team?.owner?.read();
  user.team?.owner?.full_name;
}

function test4(user: SelectedPick<UserRecord, ['partner', 'team']>) {
  user.partner;
  user.partner.xata_id;
  user.partner.read();
  user.partner.full_name;
  // @ts-expect-error
  user.partner.full_name = null;
  // @ts-expect-error
  user.team.xata_id;
  user.team?.xata_id;
  // @ts-expect-error
  user.team.read();
  user.team?.read();

  // @ts-expect-error
  user.partner = null;
  user.team = null;
}

function test5(user: SelectedPick<UserRecord, ['partner.*', 'team.*']>) {
  user.partner;
  user.partner.xata_id;
  user.partner.read();
  user.partner.full_name;
  // @ts-expect-error
  user.partner.full_name = null;
  // @ts-expect-error
  user.team.xata_id;
  user.team?.xata_id;
  // @ts-expect-error
  user.team.read();
  user.team?.read();

  // @ts-expect-error
  user.partner = null;
  user.team = null;
}

function test6(user: SelectedPick<UserRecord, ['file.*', 'partner.file.base64Content', 'partner.file.signedUrl']>) {
  user.file?.base64Content;
  user.file?.signedUrl;
  user.partner.file?.base64Content;
  user.partner.file?.signedUrl;
}

test('fake test', () => {
  // This is a fake test to make sure that the type definitions in this file are working
});
