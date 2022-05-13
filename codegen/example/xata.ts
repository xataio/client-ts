import { buildClient, BaseClientOptions, XataRecord } from '../../client/src';

export interface Team {
  owner?: UserRecord | null;
  name?: string | null;
  labels?: string[] | null;
  a?: string | null;
  b?: string | null;
}

export type TeamRecord = Team & XataRecord;

export interface User {
  team?: TeamRecord | null;
  email?: string | null;
  full_name?: string | null;
  address?: { zipcode?: number | null; street?: string | null } | null;
}

export type UserRecord = User & XataRecord;

export interface Foobar {
  name?: string | null;
  email?: string | null;
  count?: number | null;
}

export type FoobarRecord = Foobar & XataRecord;

export interface Nasdaq {
  salutation?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  accountName?: string | null;
  mailingStreet?: string | null;
  mailingCity?: string | null;
  mailingState?: string | null;
  mailingZip?: string | null;
  mailingCountry?: string | null;
  phone?: string | null;
  fax?: string | null;
  mobile?: string | null;
  accountOwner?: string | null;
  email?: string | null;
}

export type NasdaqRecord = Nasdaq & XataRecord;

export type DatabaseSchema = {
  teams: Team;
  users: User;
  foobar: Foobar;
  nasdaq: Nasdaq;
};

const links = {
  teams: [['owner', 'users']],
  users: [['team', 'teams']],
  foobar: [],
  nasdaq: []
};

const DatabaseClient = buildClient<DatabaseSchema>();

export class XataClient extends DatabaseClient {
  constructor(options?: BaseClientOptions) {
    super({ databaseURL: 'https://test-r5vcv5.xata.sh/db/test', ...options }, links);
  }
}
