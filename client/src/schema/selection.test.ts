import { exactType } from '../util/types';
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

const links = {
  teams: [['owner', 'users']],
  users: [['team', 'teams']]
} as const;

type LinkList = { [key: string]: readonly (readonly [string, string])[] };

type Links<List extends LinkList> = {
  [key in keyof List]: List[key][number][0];
};

type C = Links<typeof links>;

//                              SelectableColumn<O>                            //
// --------------------------------------------------------------------------- //

declare const teamColumns: SelectableColumn<TeamRecord>[];
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

declare const labelsValue: ValueAtColumn<TeamRecord, 'labels'>;
declare const validLabelsValue: string[] | null | undefined;
declare const invalidLabelsValue: number;

exactType(labelsValue, validLabelsValue);
// @ts-expect-error
exactType(labelsValue, invalidLabelsValue);

//                            SelectedRecordPick<O, Key>                        //
// ---------------------------------------------------------------------------- //

declare const selectedUserBaseRecord: SelectedPick<UserRecord, ['*']>;

selectedUserBaseRecord.id;
selectedUserBaseRecord.read();
selectedUserBaseRecord.full_name;
selectedUserBaseRecord.address?.street;
selectedUserBaseRecord.team?.id;
selectedUserBaseRecord.team?.read();
// @ts-expect-error
selectedUserBaseRecord.team?.name;
selectedUserBaseRecord;

declare const selectedUserFullRecord: SelectedPick<UserRecord, ['*', 'team.*']>;

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

declare const selectedUserNestedRecord: SelectedPick<UserRecord, ['team.owner.*']>;

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

declare const selectedUserNestedRecord2: SelectedPick<UserRecord, ['team.owner.address']>;

selectedUserNestedRecord2.team?.owner?.address;
