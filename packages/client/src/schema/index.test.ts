/* eslint-disable no-useless-escape */

import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { BaseClient, BaseClientOptions } from '..';
import { server } from '../../../../test/mock_server';
import { Response } from '../util/fetch';

interface User {
  xata_id: string;
  name: string;
}

const buildClient = (options: Partial<BaseClientOptions> = {}) => {
  const {
    apiKey = '1234',
    databaseURL = 'https://mock.xata.sh/db/xata',
    branch = 'main',
    clientName,
    xataAgentExtra
  } = options;

  // @ts-expect-error - Fetch doesn't appear in globalThis yet
  const fetch = vi.fn(globalThis.realFetch);
  const client = new BaseClient({ fetch, apiKey, databaseURL, branch, clientName, xataAgentExtra }, [
    {
      name: 'users',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' }
      ]
    }
  ]);

  const users = client.db.users;

  return { fetch, client, users };
};

const getHeaders = (fetchMock: any) => fetchMock.calls[0][1]?.headers as Record<string, string>;

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('client options', () => {
  test('throws if mandatory options are missing', () => {
    const { XATA_DATABASE_URL, XATA_API_KEY } = process.env;
    process.env.XATA_API_KEY = '';
    process.env.XATA_DATABASE_URL = '';

    // @ts-expect-error Options are mandatory in TypeScript
    expect(() => buildClient({ apiKey: null }, {})).toThrow('Option apiKey is required');

    // @ts-expect-error Options are mandatory in TypeScript
    expect(() => buildClient({ databaseURL: null }, {})).toThrow('Option databaseURL is required');

    process.env.XATA_API_KEY = XATA_API_KEY;
    process.env.XATA_DATABASE_URL = XATA_DATABASE_URL;
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

    const result = {
      url: fetch.mock.calls[0][0],
      method: fetch.mock.calls[0][1]?.method,
      body: fetch.mock.calls[0][1]?.body
    };

    expect(result).toMatchInlineSnapshot(`
      {
        "body": "{"page":{"size":1},"columns":["*"]}",
        "method": "POST",
        "url": "https://mock.xata.sh/db/xata:branch/tables/users/query",
      }
    `);
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

    const result = {
      url: fetch.mock.calls[0][0],
      method: fetch.mock.calls[0][1]?.method,
      body: fetch.mock.calls[0][1]?.body
    };

    expect(result).toMatchInlineSnapshot(`
      {
        "body": "{"page":{"size":1},"columns":["*"]}",
        "method": "POST",
        "url": "https://mock.xata.sh/db/xata:main/tables/users/query",
      }
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

    await users.getMany({ pagination: { size: 20 } });

    const result = {
      url: fetch.mock.calls[0][0],
      method: fetch.mock.calls[0][1]?.method,
      body: fetch.mock.calls[0][1]?.body
    };

    expect(result).toMatchInlineSnapshot(`
      {
        "body": "{"page":{"size":20},"columns":["*"]}",
        "method": "POST",
        "url": "https://mock.xata.sh/db/xata:main/tables/users/query",
      }
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

    const result: any = await users.getFirst();
    expect(result?.a).toEqual(json.a);
    expect(result?.email).toBeNull();
    expect(result?.read).toBeDefined();
  });

  test('sets X-Xata-Agent header', async () => {
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

    const xataAgentHeader = getHeaders(fetch.mock)?.['X-Xata-Agent'];

    expect(xataAgentHeader).toContain(`client=TS_SDK; version=`);
  });

  test('sets X-Xata-Agent header with service', async () => {
    const { fetch, users } = buildClient({ clientName: 'myService' });

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

    const xataAgentHeader = getHeaders(fetch.mock)?.['X-Xata-Agent'];

    expect(xataAgentHeader).toContain(`client=TS_SDK; version=`);
    expect(xataAgentHeader).toContain(`service=myService`);
  });
});

test('sets X-Xata-Agent header with extras', async () => {
  const { fetch, users } = buildClient({ clientName: 'myService', xataAgentExtra: { hello: 'world' } });

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

  const xataAgentHeader = getHeaders(fetch.mock)?.['X-Xata-Agent'];

  expect(xataAgentHeader).toContain(`client=TS_SDK; version=`);
  expect(xataAgentHeader).toContain(`service=myService`);
  expect(xataAgentHeader).toContain(`hello=world`);
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
  return calls.map((call) => ({
    url: call[0],
    method: call[1]?.method,
    body: call[1]?.body
  }));
}

describe('query', () => {
  describe('getMany', () => {
    test('simple query', async () => {
      const { fetch, users } = buildClient();

      const expected = { method: 'POST', path: '/tables/users/query', body: {} };
      const result = await expectRequest(fetch, expected, () => users.getMany(), {
        records: [],
        meta: { page: { cursor: '', more: false } }
      });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "body": "{"page":{"size":20},"columns":["*"]}",
            "method": "POST",
            "url": "https://mock.xata.sh/db/xata:main/tables/users/query",
          },
        ]
      `);
    });

    test('query with one filter', async () => {
      const { fetch, users } = buildClient();

      const expected = { method: 'POST', path: '/tables/users/query', body: { filter: { $all: [{ name: 'foo' }] } } };
      const result = await expectRequest(fetch, expected, () => users.filter('name', 'foo').getMany(), {
        records: [],
        meta: { page: { cursor: '', more: false } }
      });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "body": "{"filter":{"$all":[{"name":"foo"}]},"page":{"size":20},"columns":["*"]}",
            "method": "POST",
            "url": "https://mock.xata.sh/db/xata:main/tables/users/query",
          },
        ]
      `);
    });
  });

  describe('getFirst', () => {
    test('returns a single object', async () => {
      const { fetch, users } = buildClient();

      const resultBody = { records: [{ xata_id: '1234' }], meta: { page: { cursor: '', more: false } } };
      const expected = { method: 'POST', path: '/tables/users/query', body: { page: { size: 1 } } };
      const result = await expectRequest(
        fetch,
        expected,
        async () => {
          const first = await users.getFirst();
          expect(first?.xata_id).toBe(resultBody.records[0].xata_id);
        },
        resultBody
      );

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "body": "{"page":{"size":1},"columns":["*"]}",
            "method": "POST",
            "url": "https://mock.xata.sh/db/xata:main/tables/users/query",
          },
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
          {
            "body": "{"page":{"size":1},"columns":["*"]}",
            "method": "POST",
            "url": "https://mock.xata.sh/db/xata:main/tables/users/query",
          },
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
        {
          "body": undefined,
          "method": "GET",
          "url": "https://mock.xata.sh/db/xata:main/tables/users/data/rec_1234?columns=*",
        },
      ]
    `);
  });

  test('reads an object by id with multiple columns', async () => {
    const { fetch, users } = buildClient();

    const id = 'rec_1234';
    const expected = { method: 'GET', path: `/tables/users/data/${id}`, body: undefined };
    const result = await expectRequest(fetch, expected, () => users.read(id, ['name', 'age']));

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "body": undefined,
          "method": "GET",
          "url": "https://mock.xata.sh/db/xata:main/tables/users/data/rec_1234?columns=name%2Cage",
        },
      ]
    `);
  });
});

describe('Repository.update', () => {
  test('updates an object successfully', async () => {
    const { fetch, users } = buildClient();

    const object = { xata_id: 'rec_1234', xata_version: 1, name: 'Ada' };
    const expected = [
      { method: 'PUT', path: `/tables/users/data/${object.xata_id}`, body: object },
      { method: 'GET', path: `/tables/users/data/${object.xata_id}` }
    ];
    const result = await expectRequest(
      fetch,
      expected,
      async () => {
        const result = await users.update(object.xata_id, object);
        expect(result?.xata_id).toBe(object.xata_id);
      },
      { xata_id: object.xata_id }
    );

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "body": "{"name":"Ada"}",
          "method": "PATCH",
          "url": "https://mock.xata.sh/db/xata:main/tables/users/data/rec_1234?columns=*",
        },
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
      await users.delete(id);
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "body": undefined,
          "method": "DELETE",
          "url": "https://mock.xata.sh/db/xata:main/tables/users/data/rec_1234?columns=*",
        },
      ]
    `);
  });
});

describe('create', () => {
  test('successful', async () => {
    const { fetch, users } = buildClient();

    const created = { xata_id: 'rec_1234', _version: 0 };
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
        expect(result.xata_id).toBe(created.xata_id);
      },
      created
    );

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "body": "{"name":"Ada"}",
          "method": "POST",
          "url": "https://mock.xata.sh/db/xata:main/tables/users/data?columns=*",
        },
      ]
    `);
  });
});
