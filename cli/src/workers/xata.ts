import { buildClient, BaseClientOptions, XataRecord } from '@xata.io/client';

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

const tables = ['teams', 'users'];

const DatabaseClient = buildClient();

export class XataClient extends DatabaseClient<DatabaseSchema> {
  constructor(options?: BaseClientOptions) {
    super({ databaseURL: 'https://test-r5vcv5.xata.sh/db/test', ...options }, tables);
  }
}

type XataWorkerContext = { xata: XataClient; req: Request; res: Response };

export function xataWorker<T extends (ctx: XataWorkerContext, ...args: any[]) => any>(name: string, callback: T) {
  // If env is development: return a fn qthat call http://localhost:8080/workers?worker=name-prefix-1241hg2&args=${b}
  // If env is production: return a fn that calls https://workers.xata.io?worker=name-prefix-1241hg2&args=${b}

  if (process.env.NODE_ENV === 'development') {
  } else {
  }
}

xataWorker('name-prefix', ({ xata }, name: string) => {
  return xata.db.teams.filter('name', name).getAll();
});
