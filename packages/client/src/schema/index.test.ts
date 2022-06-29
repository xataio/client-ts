/* eslint-disable no-useless-escape */

import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { BaseClient, BaseClientOptions } from '..';
import { server } from '../../../../test/mock_server';
import { XataRecord } from './record';
import realFetch from 'cross-fetch';
interface User extends XataRecord {
  name: string;
}

const buildClient = (options: Partial<BaseClientOptions> = {}) => {
  const { apiKey = '1234', databaseURL = 'https://mock.xata.sh/db/xata', branch = 'main' } = options;

  const fetch = vi.fn(realFetch);
  const client = new BaseClient({ fetch, apiKey, databaseURL, branch });

  const users = client.db.users;

  return { fetch, client, users };
};

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('client options', () => {
  test('throws if mandatory options are missing', () => {
    const { XATA_DATABASE_URL, XATA_API_KEY } = process.env;
    process.env.XATA_API_KEY = '';
    process.env.XATA_DATABASE_URL = '';

    // @ts-expect-error Options are mandatory in TypeScript
    expect(() => buildClient({ apiKey: null }, {})).toThrow('Options databaseURL and apiKey are required');

    // @ts-expect-error Options are mandatory in TypeScript
    expect(() => buildClient({ databaseURL: null }, {})).toThrow('Options databaseURL and apiKey are required');

    process.env.XATA_API_KEY = XATA_API_KEY;
    process.env.XATA_DATABASE_URL = XATA_DATABASE_URL;
  });

  test('throws if branch cannot be resolved', async () => {
    const { users } = buildClient({ branch: () => null });

    await expect(users.getFirst()).rejects.toThrow('Unable to resolve branch value');
  });

  test('provide branch as a string', async () => {
    const { fetch, users } = buildClient({ branch: 'branch' });

    fetch.mockImplementationOnce(async () => {
      return {
        ok: true,
        json: async () => ({
          records: [],
          meta: { page: { cursor: '', more: false } }
        })
      } as Response;
    });

    await users.getFirst();

    expect(fetch.mock.calls[0]).toMatchInlineSnapshot(`
      [
        "https://mock.xata.sh/db/xata:branch/tables/users/query",
        {
          "body": "{\\"page\\":{\\"size\\":1},\\"columns\\":[\\"*\\"]}",
          "headers": {
            "Authorization": "Bearer 1234",
            "Content-Type": "application/json",
            "Host": "mock.xata.sh",
          },
          "method": "POST",
        },
      ]
    `);
  });

  test('provide branch as an array', async () => {
    const { fetch, users } = buildClient({
      branch: [process.env.NOT_DEFINED_VARIABLE, async () => null, 'branch', 'main']
    });

    fetch.mockImplementationOnce(async () => {
      return {
        ok: true,
        json: async () => ({
          records: [],
          meta: { page: { cursor: '', more: false } }
        })
      } as Response;
    });

    await users.getFirst();

    expect(fetch.mock.calls[0]).toMatchInlineSnapshot(`
      [
        "https://mock.xata.sh/db/xata:branch/tables/users/query",
        {
          "body": "{\\"page\\":{\\"size\\":1},\\"columns\\":[\\"*\\"]}",
          "headers": {
            "Authorization": "Bearer 1234",
            "Content-Type": "application/json",
            "Host": "mock.xata.sh",
          },
          "method": "POST",
        },
      ]
    `);
  });

  test('provide branch as a function', async () => {
    const { fetch, users } = buildClient({ branch: () => 'branch' });

    fetch.mockImplementationOnce(async () => {
      return {
        ok: true,
        json: async () => ({
          records: [],
          meta: { page: { cursor: '', more: false } }
        })
      } as Response;
    });

    await users.getFirst();

    expect(fetch.mock.calls[0]).toMatchInlineSnapshot(`
      [
        "https://mock.xata.sh/db/xata:branch/tables/users/query",
        {
          "body": "{\\"page\\":{\\"size\\":1},\\"columns\\":[\\"*\\"]}",
          "headers": {
            "Authorization": "Bearer 1234",
            "Content-Type": "application/json",
            "Host": "mock.xata.sh",
          },
          "method": "POST",
        },
      ]
    `);
  });

  test('ensure branch resolution is memoized', async () => {
    const branchGetter = vi.fn(() => 'branch');

    const { fetch, users } = buildClient({ branch: branchGetter });

    fetch.mockImplementationOnce(async () => {
      return {
        ok: true,
        json: async () => ({
          records: [],
          meta: { page: { cursor: '', more: false } }
        })
      } as Response;
    });

    await users.getFirst();
    await users.getRecords();

    expect(branchGetter).toHaveBeenCalledTimes(1);
  });
});

describe('request', () => {
  test('builds the right arguments for a GET request', async () => {
    const { fetch, users } = buildClient();

    fetch.mockImplementationOnce(async () => {
      return {
        ok: true,
        json: async () => ({
          records: [],
          meta: { page: { cursor: '', more: false } }
        })
      } as Response;
    });

    await users.getFirst();

    expect(fetch.mock.calls[0]).toMatchInlineSnapshot(`
      [
        "https://mock.xata.sh/db/xata:main/tables/users/query",
        {
          "body": "{\\"page\\":{\\"size\\":1},\\"columns\\":[\\"*\\"]}",
          "headers": {
            "Authorization": "Bearer 1234",
            "Content-Type": "application/json",
            "Host": "mock.xata.sh",
          },
          "method": "POST",
        },
      ]
    `);
  });

  test('builds the right arguments for a POST request', async () => {
    const { fetch, users } = buildClient();

    fetch.mockImplementationOnce(async () => {
      return {
        ok: true,
        json: async () => ({
          records: [],
          meta: { page: { cursor: '', more: false } }
        })
      } as Response;
    });

    await users.getRecords({ pagination: { size: 20 } });

    expect(fetch.mock.calls[0]).toMatchInlineSnapshot(`
      [
        "https://mock.xata.sh/db/xata:main/tables/users/query",
        {
          "body": "{\\"page\\":{\\"size\\":20},\\"columns\\":[\\"*\\"]}",
          "headers": {
            "Authorization": "Bearer 1234",
            "Content-Type": "application/json",
            "Host": "mock.xata.sh",
          },
          "method": "POST",
        },
      ]
    `);
  });

  test('throws if the response is not ok', async () => {
    const { fetch, users } = buildClient();

    fetch.mockImplementationOnce(async () => {
      return {
        ok: false,
        status: 404,
        json: async () => ({ message: 'Not Found' })
      } as Response;
    });

    await expect(users.getFirst()).rejects.toMatchInlineSnapshot('[Error: Not Found]');
  });

  test('returns the json body if the response is ok', async () => {
    const { fetch, users } = buildClient();

    const json = { a: 1 };
    fetch.mockImplementationOnce(async () => {
      return {
        ok: true,
        json: async () => ({
          records: [json],
          meta: { page: { cursor: '', more: false } }
        })
      } as Response;
    });

    const result = await users.getFirst();
    expect(result).toEqual(json);
  });
});

type ExpectedRequest = {
  method: string;
  path: string;
  body?: unknown;
};

async function expectRequest(
  fetch: ReturnType<typeof vi.fn>,
  expectedRequest: ExpectedRequest[] | ExpectedRequest,
  callback: () => void,
  response?: any
): Promise<any[]> {
  fetch.mockImplementationOnce(() => {
    return {
      ok: true,
      json: async () => response
    };
  });

  await callback();

  const { calls } = fetch.mock;
  return calls;
}

describe('query', () => {
  describe('getRecords', () => {
    test('simple query', async () => {
      const { fetch, users } = buildClient();

      const expected = { method: 'POST', path: '/tables/users/query', body: {} };
      const result = await expectRequest(fetch, expected, () => users.getRecords(), {
        records: [],
        meta: { page: { cursor: '', more: false } }
      });

      expect(result).toMatchInlineSnapshot(`
        [
          [
            "https://mock.xata.sh/db/xata:main/tables/users/query",
            {
              "body": "{\\"columns\\":[\\"*\\"]}",
              "headers": {
                "Authorization": "Bearer 1234",
                "Content-Type": "application/json",
                "Host": "mock.xata.sh",
              },
              "method": "POST",
            },
          ],
          [
            "https://mock.xata.sh/db/xata:main",
            {
              "body": undefined,
              "headers": {
                "Authorization": "Bearer 1234",
                "Content-Type": "application/json",
                "Host": "mock.xata.sh",
              },
              "method": "GET",
            },
          ],
        ]
      `);
    });

    test('query with one filter', async () => {
      const { fetch, users } = buildClient();

      const expected = { method: 'POST', path: '/tables/users/query', body: { filter: { $all: [{ name: 'foo' }] } } };
      const result = await expectRequest(fetch, expected, () => users.filter('name', 'foo').getRecords(), {
        records: [],
        meta: { page: { cursor: '', more: false } }
      });

      expect(result).toMatchInlineSnapshot(`
        [
          [
            "https://mock.xata.sh/db/xata:main/tables/users/query",
            {
              "body": "{\\"filter\\":{\\"$all\\":[{\\"name\\":\\"foo\\"}]},\\"columns\\":[\\"*\\"]}",
              "headers": {
                "Authorization": "Bearer 1234",
                "Content-Type": "application/json",
                "Host": "mock.xata.sh",
              },
              "method": "POST",
            },
          ],
          [
            "https://mock.xata.sh/db/xata:main",
            {
              "body": undefined,
              "headers": {
                "Authorization": "Bearer 1234",
                "Content-Type": "application/json",
                "Host": "mock.xata.sh",
              },
              "method": "GET",
            },
          ],
        ]
      `);
    });
  });

  describe('getFirst', () => {
    test('returns a single object', async () => {
      const { fetch, users } = buildClient();

      const resultBody = { records: [{ id: '1234' }], meta: { page: { cursor: '', more: false } } };
      const expected = { method: 'POST', path: '/tables/users/query', body: { page: { size: 1 } } };
      const result = await expectRequest(
        fetch,
        expected,
        async () => {
          const first = await users.getFirst();
          expect(first?.id).toBe(resultBody.records[0].id);
        },
        resultBody
      );

      expect(result).toMatchInlineSnapshot(`
        [
          [
            "https://mock.xata.sh/db/xata:main/tables/users/query",
            {
              "body": "{\\"page\\":{\\"size\\":1},\\"columns\\":[\\"*\\"]}",
              "headers": {
                "Authorization": "Bearer 1234",
                "Content-Type": "application/json",
                "Host": "mock.xata.sh",
              },
              "method": "POST",
            },
          ],
          [
            "https://mock.xata.sh/db/xata:main",
            {
              "body": undefined,
              "headers": {
                "Authorization": "Bearer 1234",
                "Content-Type": "application/json",
                "Host": "mock.xata.sh",
              },
              "method": "GET",
            },
          ],
        ]
      `);
    });

    test('returns null if no objects are returned', async () => {
      const { fetch, users } = buildClient();

      const expected = { method: 'POST', path: '/tables/users/query', body: { page: { size: 1 } } };
      const result = await expectRequest(
        fetch,
        expected,
        async () => {
          const first = await users.getFirst();
          expect(first).toBeNull();
        },
        { records: [], meta: { page: { cursor: '', more: false } } }
      );

      expect(result).toMatchInlineSnapshot(`
        [
          [
            "https://mock.xata.sh/db/xata:main/tables/users/query",
            {
              "body": "{\\"page\\":{\\"size\\":1},\\"columns\\":[\\"*\\"]}",
              "headers": {
                "Authorization": "Bearer 1234",
                "Content-Type": "application/json",
                "Host": "mock.xata.sh",
              },
              "method": "POST",
            },
          ],
          [
            "https://mock.xata.sh/db/xata:main",
            {
              "body": undefined,
              "headers": {
                "Authorization": "Bearer 1234",
                "Content-Type": "application/json",
                "Host": "mock.xata.sh",
              },
              "method": "GET",
            },
          ],
        ]
      `);
    });
  });
});

describe('read', () => {
  test('reads an object by id successfully', async () => {
    const { fetch, users } = buildClient();

    const id = 'rec_1234';
    const expected = { method: 'GET', path: `/tables/users/data/${id}`, body: undefined };
    const result = await expectRequest(fetch, expected, () => users.read(id));

    expect(result).toMatchInlineSnapshot(`
      [
        [
          "https://mock.xata.sh/db/xata:main/tables/users/data/rec_1234",
          {
            "body": undefined,
            "headers": {
              "Authorization": "Bearer 1234",
              "Content-Type": "application/json",
              "Host": "mock.xata.sh",
            },
            "method": "GET",
          },
        ],
        [
          "https://mock.xata.sh/db/xata:main",
          {
            "body": undefined,
            "headers": {
              "Authorization": "Bearer 1234",
              "Content-Type": "application/json",
              "Host": "mock.xata.sh",
            },
            "method": "GET",
          },
        ],
      ]
    `);
  });
});

describe('Repository.update', () => {
  test('updates an object successfully', async () => {
    const { fetch, users } = buildClient();

    const object = { id: 'rec_1234', xata: { version: 1 }, name: 'Ada' } as User;
    const expected = [
      { method: 'PUT', path: `/tables/users/data/${object.id}`, body: object },
      { method: 'GET', path: `/tables/users/data/${object.id}` }
    ];
    const result = await expectRequest(
      fetch,
      expected,
      async () => {
        const result = await users.update(object.id, object);
        expect(result.id).toBe(object.id);
      },
      { id: object.id }
    );

    expect(result).toMatchInlineSnapshot(`
      [
        [
          "https://mock.xata.sh/db/xata:main/tables/users/data/rec_1234",
          {
            "body": "{\\"id\\":\\"rec_1234\\",\\"name\\":\\"Ada\\"}",
            "headers": {
              "Authorization": "Bearer 1234",
              "Content-Type": "application/json",
              "Host": "mock.xata.sh",
            },
            "method": "PATCH",
          },
        ],
        [
          "https://mock.xata.sh/db/xata:main/tables/users/data/rec_1234",
          {
            "body": undefined,
            "headers": {
              "Authorization": "Bearer 1234",
              "Content-Type": "application/json",
              "Host": "mock.xata.sh",
            },
            "method": "GET",
          },
        ],
        [
          "https://mock.xata.sh/db/xata:main",
          {
            "body": undefined,
            "headers": {
              "Authorization": "Bearer 1234",
              "Content-Type": "application/json",
              "Host": "mock.xata.sh",
            },
            "method": "GET",
          },
        ],
      ]
    `);
  });
});

describe('Repository.delete', () => {
  test('deletes a record by id successfully', async () => {
    const { fetch, users } = buildClient();

    const id = 'rec_1234';
    const expected = { method: 'DELETE', path: `/tables/users/data/${id}`, body: undefined };
    const result = await expectRequest(fetch, expected, async () => {
      const result = await users.delete(id);
      expect(result).toBe(undefined);
    });

    expect(result).toMatchInlineSnapshot(`
      [
        [
          "https://mock.xata.sh/db/xata:main/tables/users/data/rec_1234",
          {
            "body": undefined,
            "headers": {
              "Authorization": "Bearer 1234",
              "Content-Type": "application/json",
              "Host": "mock.xata.sh",
            },
            "method": "DELETE",
          },
        ],
      ]
    `);
  });
});

describe('create', () => {
  test('successful', async () => {
    const { fetch, users } = buildClient();

    const created = { id: 'rec_1234', _version: 0 };
    const object = { name: 'Ada' } as User;
    const expected = [
      { method: 'POST', path: '/tables/users/data', body: object },
      {
        method: 'GET',
        path: '/tables/users/data/rec_1234',
        body: undefined
      }
    ];

    const result = await expectRequest(
      fetch,
      expected,
      async () => {
        const result = await users.create(object);
        expect(result.id).toBe(created.id);
      },
      created
    );

    expect(result).toMatchInlineSnapshot(`
      [
        [
          "https://mock.xata.sh/db/xata:main/tables/users/data",
          {
            "body": "{\\"name\\":\\"Ada\\"}",
            "headers": {
              "Authorization": "Bearer 1234",
              "Content-Type": "application/json",
              "Host": "mock.xata.sh",
            },
            "method": "POST",
          },
        ],
        [
          "https://mock.xata.sh/db/xata:main/tables/users/data/rec_1234",
          {
            "body": undefined,
            "headers": {
              "Authorization": "Bearer 1234",
              "Content-Type": "application/json",
              "Host": "mock.xata.sh",
            },
            "method": "GET",
          },
        ],
        [
          "https://mock.xata.sh/db/xata:main",
          {
            "body": undefined,
            "headers": {
              "Authorization": "Bearer 1234",
              "Content-Type": "application/json",
              "Host": "mock.xata.sh",
            },
            "method": "GET",
          },
        ],
      ]
    `);
  });
});
