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
    databaseURL = 'https://my-workspace-v0fo9s.us-east-1.xata.sh/db/mydb',
    branch = 'main',
    clientName,
    xataAgentExtra
  } = options;

  // @ts-expect-error - Fetch doesn't appear in globalThis yet
  const fetch = vi.fn(globalThis.realFetch);
  const client = new BaseClient(
    { fetch, apiKey, databaseURL, branch, clientName, xataAgentExtra },
    {
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'xata_id', type: 'string' },
            { name: 'name', type: 'string' },
            { name: 'email', type: 'string' }
          ]
        }
      ]
    }
  );

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

    fetch.mockImplementation(async () => {
      return {
        ok: true,
        json: async () => {
          return {
            records: [],
            meta: { page: { cursor: '', more: false } }
          };
        }
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
        "body": "{"statement":"select * from \\"users\\" order by \\"xata_id\\" asc limit $1","params":["1"]}",
        "method": "POST",
        "url": "https://my-workspace-v0fo9s.us-east-1.xata.sh/db/mydb:branch/sql",
      }
    `);
  });
});

describe('request', () => {
  test('builds the right arguments for a GET request', async () => {
    const { fetch, users } = buildClient();

    fetch.mockImplementation(async () => {
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
        "body": "{"statement":"select * from \\"users\\" order by \\"xata_id\\" asc limit $1","params":["1"]}",
        "method": "POST",
        "url": "https://my-workspace-v0fo9s.us-east-1.xata.sh/db/mydb:main/sql",
      }
    `);
  });

  test('builds the right arguments for a POST request', async () => {
    const { fetch, users } = buildClient();

    fetch.mockImplementation(async () => {
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
        "body": "{"statement":"select * from \\"users\\" order by \\"xata_id\\" asc limit $1","params":["20"]}",
        "method": "POST",
        "url": "https://my-workspace-v0fo9s.us-east-1.xata.sh/db/mydb:main/sql",
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

    await expect(users.getFirst()).rejects.toMatchInlineSnapshot(`[Error: Not Found]`);
  });

  test('returns the json body if the response is ok', async () => {
    const { fetch, users } = buildClient();

    const json = { a: 1 };
    fetch.mockImplementation(async () => {
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

    fetch.mockImplementation(async () => {
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

    fetch.mockImplementation(async () => {
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

  fetch.mockImplementation(async () => {
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
  fetch.mockImplementation(() => {
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
            "body": "{"statement":"select * from \\"users\\" order by \\"xata_id\\" asc limit $1","params":["20"]}",
            "method": "POST",
            "url": "https://my-workspace-v0fo9s.us-east-1.xata.sh/db/mydb:main/sql",
          },
          {
            "body": "{"statement":"select * from \\"users\\" order by \\"xata_id\\" asc limit $1 offset $2","params":["1","0"]}",
            "method": "POST",
            "url": "https://my-workspace-v0fo9s.us-east-1.xata.sh/db/mydb:main/sql",
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
            "body": "{"statement":"select * from \\"users\\" where CAST (\\"name\\" AS text) = $1 order by \\"xata_id\\" asc limit $2","params":["foo","20"]}",
            "method": "POST",
            "url": "https://my-workspace-v0fo9s.us-east-1.xata.sh/db/mydb:main/sql",
          },
          {
            "body": "{"statement":"select * from \\"users\\" where CAST (\\"name\\" AS text) = $1 order by \\"xata_id\\" asc limit $2 offset $3","params":["foo","1","0"]}",
            "method": "POST",
            "url": "https://my-workspace-v0fo9s.us-east-1.xata.sh/db/mydb:main/sql",
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
            "body": "{"statement":"select * from \\"users\\" order by \\"xata_id\\" asc limit $1","params":["1"]}",
            "method": "POST",
            "url": "https://my-workspace-v0fo9s.us-east-1.xata.sh/db/mydb:main/sql",
          },
          {
            "body": "{"statement":"select * from \\"users\\" order by \\"xata_id\\" asc limit $1 offset $2","params":["1","1"]}",
            "method": "POST",
            "url": "https://my-workspace-v0fo9s.us-east-1.xata.sh/db/mydb:main/sql",
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
            "body": "{"statement":"select * from \\"users\\" order by \\"xata_id\\" asc limit $1","params":["1"]}",
            "method": "POST",
            "url": "https://my-workspace-v0fo9s.us-east-1.xata.sh/db/mydb:main/sql",
          },
          {
            "body": "{"statement":"select * from \\"users\\" order by \\"xata_id\\" asc limit $1 offset $2","params":["1","0"]}",
            "method": "POST",
            "url": "https://my-workspace-v0fo9s.us-east-1.xata.sh/db/mydb:main/sql",
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
    const result = await expectRequest(fetch, [], () => users.read(id), {
      records: [{ xata_id: id }],
      meta: { page: { cursor: '', more: false } }
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "body": "{"statement":"select * from \\"users\\" where \\"xata_id\\" = $1","params":["rec_1234"]}",
          "method": "POST",
          "url": "https://my-workspace-v0fo9s.us-east-1.xata.sh/db/mydb:main/sql",
        },
      ]
    `);
  });

  test('reads an object by id with multiple columns', async () => {
    const { fetch, users } = buildClient();

    const id = 'rec_1234';
    const result = await expectRequest(fetch, [], () => users.read(id, ['name', 'age']), {
      records: [{ xata_id: id }],
      meta: { page: { cursor: '', more: false } }
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "body": "{"statement":"select \\"name\\", \\"age\\" from \\"users\\" where \\"xata_id\\" = $1","params":["rec_1234"]}",
          "method": "POST",
          "url": "https://my-workspace-v0fo9s.us-east-1.xata.sh/db/mydb:main/sql",
        },
      ]
    `);
  });
});

describe('Repository.update', () => {
  test('updates an object successfully', async () => {
    const { fetch, users } = buildClient();

    const object = { xata_id: 'rec_1234', xata_version: 1, name: 'Ada' };
    const result = await expectRequest(
      fetch,
      [],
      async () => {
        const result = await users.update(object.xata_id, object);
        expect(result?.xata_id).toBe(object.xata_id);
      },
      {
        records: [{ xata_id: object.xata_id }],
        meta: { page: { cursor: '', more: false } }
      }
    );

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "body": "{"statement":"update \\"users\\" set \\"name\\" = $1 where \\"xata_id\\" = $2 returning *","params":["Ada","rec_1234"]}",
          "method": "POST",
          "url": "https://my-workspace-v0fo9s.us-east-1.xata.sh/db/mydb:main/sql",
        },
      ]
    `);
  });
});

describe('Repository.delete', () => {
  test('deletes a record by id successfully', async () => {
    const { fetch, users } = buildClient();

    const id = 'rec_1234';
    const result = await expectRequest(
      fetch,
      [],
      async () => {
        await users.delete(id);
      },
      {
        records: [],
        meta: { page: { cursor: '', more: false } }
      }
    );

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "body": "{"statement":"delete from \\"users\\" where \\"xata_id\\" = $1 returning *","params":["rec_1234"]}",
          "method": "POST",
          "url": "https://my-workspace-v0fo9s.us-east-1.xata.sh/db/mydb:main/sql",
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

    const result = await expectRequest(
      fetch,
      [],
      async () => {
        const result = await users.create(object);
        expect(result.xata_id).toBe(created.xata_id);
      },
      {
        records: [created],
        meta: { page: { cursor: '', more: false } }
      }
    );

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "body": "{"statement":"insert into \\"users\\" (\\"name\\") values ($1) returning *","params":["Ada"]}",
          "method": "POST",
          "url": "https://my-workspace-v0fo9s.us-east-1.xata.sh/db/mydb:main/sql",
        },
      ]
    `);
  });
});
