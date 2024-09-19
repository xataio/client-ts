import { afterAll, beforeEach, test } from 'vitest';

const REGION = 'us-east-1';
const baseUrl = `https://test-1234.${REGION}.xata.sh/db/db1:main`;

export const baseFetch = (url: string, request: any) => {
  if (url === 'https://api.xata.io/workspaces' && request.method === 'GET') {
    return {
      ok: true,
      json: async () => ({
        workspaces: [{ id: 'test-1234', name: 'test-1234' }]
      })
    };
  }

  if (url === 'https://api.xata.io/workspaces/test-1234/dbs' && request.method === 'GET') {
    return {
      ok: true,
      json: async () => ({
        databases: [{ name: 'db1', region: REGION }]
      })
    };
  }

  if (url === `${baseUrl}` && request.method === 'GET') {
    return {
      ok: true,
      json: async () => ({
        usePgRoll: true,
        schema: { tables: [{ name: 'table1', columns: [{ name: 'description', type: 'string' }] }] }
      })
    };
  }

  if (url === `${baseUrl}/schema` && request.method === 'GET') {
    return {
      ok: true,
      json: async () => ({
        schema: {
          name: 'bb_hmtsb6hnd552p1rencda7oo3eg_3hae5b',
          tables: {
            table1: {
              oid: '747164',
              name: 'table1',
              comment: '',
              columns: {
                a: {
                  name: 'description',
                  type: 'string',
                  default: null,
                  nullable: true,
                  unique: false,
                  comment: ''
                },
                xata_createdat: {
                  name: '_createdat',
                  type: 'timestamptz',
                  default: 'now()',
                  nullable: false,
                  unique: false,
                  comment: ''
                },
                xata_id: {
                  name: '_id',
                  type: 'text',
                  default: null,
                  nullable: false,
                  unique: true,
                  comment: ''
                },
                xata_updatedat: {
                  name: '_updatedat',
                  type: 'timestamptz',
                  default: 'now()',
                  nullable: false,
                  unique: false,
                  comment: ''
                },
                xata_version: {
                  name: '_version',
                  type: 'integer',
                  default: '0',
                  nullable: false,
                  unique: false,
                  comment: ''
                }
              },
              indexes: {},
              primaryKey: ['xata_id'],
              foreignKeys: null,
              checkConstraints: null,
              uniqueConstraints: null
            }
          }
        }
      })
    };
  }

  throw new Error(`Unexpected fetch request: ${url} ${request.method}`);
};

export function clearEnvVariables() {
  const env = { ...process.env };

  beforeEach(() => {
    process.env = { NODE_ENV: 'test' };
  });

  afterAll(() => {
    process.env = env;
  });
}

test('nothing', () => {
  // nothing
});
