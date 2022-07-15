import { buildClient, BaseClientOptions, XataRecord } from '../packages/client';
import fetch from 'node-fetch';

export interface Blog {
  title?: string | null;
  labels?: string[] | null;
  owner?: UserRecord | null;
}

export type BlogRecord = Blog & XataRecord;

export interface User {
  email?: string | null;
  full_name?: string | null;
  address?: { street?: string | null; zipcode?: number | null } | null;
  team?: BlogRecord | null;
}

export type UserRecord = User & XataRecord;

export type DatabaseSchema = {
  blogs: Blog;
  users: User;
};

const tables = ['blogs', 'users'];

const DatabaseClient = buildClient();

export class XataClient extends DatabaseClient<DatabaseSchema> {
  constructor(options?: BaseClientOptions) {
    super({ databaseURL: 'https://test-r5vcv5.xata.sh/db/test', ...options }, tables);
  }
}

type XataWorkerContext = { xata: XataClient; req: Request; res: Response };

type RemoveFirst<T> = T extends [any, ...infer U] ? U : never;

export function xataWorker<T extends (ctx: XataWorkerContext, ...args: any[]) => any>(name: string, _worker: T) {
  return async (...args: RemoveFirst<Parameters<T>>): Promise<Awaited<ReturnType<typeof _worker>>> => {
    const result = await fetch('http://localhost:64749', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      // TODO: Improve serialization
      body: JSON.stringify({
        name,
        payload: args
      })
    });

    return result.json() as any;
  };
}
