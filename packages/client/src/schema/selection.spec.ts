import { test } from 'vitest';
import { XataRecord } from './record';
import { SelectableColumn, SelectedPick, ValueAtColumn } from './selection';
import { XataFile } from './files';

interface Team {
  name: string;
  labels?: string[] | null;
  owner?: UserRecord | null;
}

type TeamRecord = Team & XataRecord;

interface User {
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

const validTeamColumns: SelectableColumn<TeamRecord>[] = ['*', 'id', 'name', 'owner.*', 'owner.date'];

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
const internalVersionColumns: SelectableColumn<Team> = 'xata.version';
const internalCreatedAtColumns: SelectableColumn<Team> = 'xata.createdAt';
const internalUpdatedAtColumns: SelectableColumn<Team> = 'xata.updatedAt';
const linkVersionColumns: SelectableColumn<Team> = 'owner.xata.version';
const linkCreatedAtColumns: SelectableColumn<Team> = 'owner.xata.createdAt';
const linkUpdatedAtColumns: SelectableColumn<Team> = 'owner.xata.updatedAt';

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

  user.xata.version;
  user.xata.createdAt;
  user.xata.updatedAt;

  // @ts-expect-error
  user.team.id;
  user.team?.id;
  user.team?.read();
  // @ts-expect-error
  user.team?.name;

  // TODO(link.xata) @ts-expect-error
  user.team?.xata.version;
  // TODO(link.xata) @ts-expect-error
  user.team?.xata.createdAt;
  // TODO(link.xata) @ts-expect-error
  user.team?.xata.updatedAt;

  user.team?.xata?.version;
  user.team?.xata?.createdAt;
  user.team?.xata?.updatedAt;

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

function test4(user: SelectedPick<UserRecord, ['partner', 'team']>) {
  user.partner;
  user.partner.id;
  user.partner.read();
  user.partner.full_name;
  // @ts-expect-error
  user.partner.full_name = null;
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

function test5(user: SelectedPick<UserRecord, ['partner.*', 'team.*']>) {
  user.partner;
  user.partner.id;
  user.partner.read();
  user.partner.full_name;
  // @ts-expect-error
  user.partner.full_name = null;
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

function test6(user: SelectedPick<UserRecord, ['file.*', 'partner.file.base64Content', 'partner.file.signedUrl']>) {
  user.file?.base64Content;
  user.file?.signedUrl;
  user.partner.file?.base64Content;
  user.partner.file?.signedUrl;
}

test('fake test', () => {
  // This is a fake test to make sure that the type definitions in this file are working
});
