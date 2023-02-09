import type { XataRecord } from '@xata.io/client';
import { EditableData, XataPlugin, XataPluginOptions } from '@xata.io/client';
import { Generated, Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';

type XataToKysely<T> = {
  [K in keyof T]: T[K] extends XataRecord ? EditableData<T[K]> & { id: Generated<string> } : T[K];
};

export class XataSQLPlugin<Database> extends XataPlugin {
  build(_options: XataPluginOptions) {
    const db = new Kysely<XataToKysely<Database>>({
      dialect: new PostgresDialect({
        pool: new Pool({
          host: '127.0.0.1',
          port: 6543,
          database: 'demo:main',
          user: '',
          password: ''
        })
      })
    });

    return {
      builder: db,
      query: (query: string) => sql`${query}`.execute(db)
    };
  }
}
