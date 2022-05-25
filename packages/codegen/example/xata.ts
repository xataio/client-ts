import { buildClient, BaseClientOptions, XataRecord } from '../../client/src';

export interface Team {
  name?: string | null;
  labels?: string[] | null;
  owner?: UserRecord | null;
}

export type TeamRecord = Team & XataRecord;

export interface User {
  email?: string | null;
  full_name?: string | null;
  address?: { street?: string | null; zipcode?: number | null } | null;
  team?: TeamRecord | null;
}

export type UserRecord = User & XataRecord;

export type DatabaseSchema = {
  teams: Team;
  users: User;
};

const links = { teams: [['owner', 'users']], users: [['team', 'teams']] };

const tables = ['teams', 'users'];

const DatabaseClient = buildClient();

export class XataClient extends DatabaseClient<DatabaseSchema> {
  constructor(options?: BaseClientOptions) {
    super({ databaseURL: 'https://test-r5vcv5.xata.sh/db/test', ...options }, links, tables);
  }
}
