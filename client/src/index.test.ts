import { BaseClient, RestRepository, XataClientOptions, XataError, XataRecord } from './';

interface User extends XataRecord {
  name: string;
}

const buildClient = (options: Partial<XataClientOptions> = {}) => {
  const {
    apiKey = '1234',
    databaseURL = 'https://my-workspace-5df34do.staging.xatabase.co/db/xata',
    branch = 'main'
  } = options;

  const fetch = jest.fn();
  const client = new BaseClient({ fetch, apiKey, databaseURL, branch }, {});
  const users = new RestRepository<User>(client, 'users');

  return { fetch, client, users };
};

describe('client options', () => {
  test('option parameters are set', () => {
    const { client } = buildClient({ apiKey: 'apiKey', databaseURL: 'url' });
    expect(client.options.apiKey).toBe('apiKey');
    expect(client.options.databaseURL).toBe('url');
  });

  test('throws if mandatory options are missing', () => {
    // @ts-expect-error Options are mandatory in TypeScript
    expect(() => buildClient({ apiKey: null }, {})).toThrow('Options databaseURL, apiKey and branch are required');

    // @ts-expect-error Options are mandatory in TypeScript
    expect(() => buildClient({ databaseURL: null }, {})).toThrow('Options databaseURL, apiKey and branch are required');

    // @ts-expect-error Options are mandatory in TypeScript
    expect(() => buildClient({ branch: null }, {})).toThrow('Options databaseURL, apiKey and branch are required');
  });

  test('throws if branch cannot be resolved', () => {
    const { users } = buildClient({ branch: () => null });

    expect(users.getOne()).rejects.toThrow('Unable to resolve branch value');
  });

  test('provide branch as a string', async () => {
    const { fetch, users } = buildClient({ branch: 'branch' });

    fetch.mockReset().mockImplementation(() => {
      return {
        ok: true,
        json: async () => ({
          records: [],
          meta: { page: { cursor: '', more: false } }
        })
      };
    });

    await users.getOne();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]).toMatchInlineSnapshot(`
      Array [
        "https://my-workspace-5df34do.staging.xatabase.co/db/xata:branch/tables/users/query",
        Object {
          "body": "{\\"filter\\":{},\\"page\\":{\\"size\\":1}}",
          "headers": Object {
            "Authorization": "Bearer 1234",
            "Content-Type": "application/json",
            "Host": "my-workspace-5df34do.staging.xatabase.co",
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

    fetch.mockReset().mockImplementation(() => {
      return {
        ok: true,
        json: async () => ({
          records: [],
          meta: { page: { cursor: '', more: false } }
        })
      };
    });

    await users.getOne();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]).toMatchInlineSnapshot(`
      Array [
        "https://my-workspace-5df34do.staging.xatabase.co/db/xata:branch/tables/users/query",
        Object {
          "body": "{\\"filter\\":{},\\"page\\":{\\"size\\":1}}",
          "headers": Object {
            "Authorization": "Bearer 1234",
            "Content-Type": "application/json",
            "Host": "my-workspace-5df34do.staging.xatabase.co",
          },
          "method": "POST",
        },
      ]
    `);
  });

  test('provide branch as a function', async () => {
    const { fetch, users } = buildClient({ branch: () => 'branch' });

    fetch.mockReset().mockImplementation(() => {
      return {
        ok: true,
        json: async () => ({
          records: [],
          meta: { page: { cursor: '', more: false } }
        })
      };
    });

    await users.getOne();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]).toMatchInlineSnapshot(`
      Array [
        "https://my-workspace-5df34do.staging.xatabase.co/db/xata:branch/tables/users/query",
        Object {
          "body": "{\\"filter\\":{},\\"page\\":{\\"size\\":1}}",
          "headers": Object {
            "Authorization": "Bearer 1234",
            "Content-Type": "application/json",
            "Host": "my-workspace-5df34do.staging.xatabase.co",
          },
          "method": "POST",
        },
      ]
    `);
  });

  test('ensure branch resolution is memoized', async () => {
    const branchGetter = jest.fn(() => 'branch');

    const { fetch, users } = buildClient({ branch: branchGetter });

    fetch.mockReset().mockImplementation(() => {
      return {
        ok: true,
        json: async () => ({
          records: [],
          meta: { page: { cursor: '', more: false } }
        })
      };
    });

    await users.getOne();
    await users.getMany();

    expect(branchGetter).toHaveBeenCalledTimes(1);
  });
});

describe('request', () => {
  test('builds the right arguments for a GET request', async () => {
    const { fetch, users } = buildClient();

    fetch.mockReset().mockImplementation(() => {
      return {
        ok: true,
        json: async () => ({
          records: [],
          meta: { page: { cursor: '', more: false } }
        })
      };
    });

    await users.getOne();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]).toMatchInlineSnapshot(`
      Array [
        "https://my-workspace-5df34do.staging.xatabase.co/db/xata:main/tables/users/query",
        Object {
          "body": "{\\"filter\\":{},\\"page\\":{\\"size\\":1}}",
          "headers": Object {
            "Authorization": "Bearer 1234",
            "Content-Type": "application/json",
            "Host": "my-workspace-5df34do.staging.xatabase.co",
          },
          "method": "POST",
        },
      ]
    `);
  });

  test('builds the right arguments for a POST request', async () => {
    const { fetch, users } = buildClient();

    fetch.mockReset().mockImplementation(() => {
      return {
        ok: true,
        json: async () => ({
          records: [],
          meta: { page: { cursor: '', more: false } }
        })
      };
    });

    await users.getMany({ page: { size: 20 } });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]).toMatchInlineSnapshot(`
      Array [
        "https://my-workspace-5df34do.staging.xatabase.co/db/xata:main/tables/users/query",
        Object {
          "body": "{\\"filter\\":{},\\"page\\":{\\"size\\":20}}",
          "headers": Object {
            "Authorization": "Bearer 1234",
            "Content-Type": "application/json",
            "Host": "my-workspace-5df34do.staging.xatabase.co",
          },
          "method": "POST",
        },
      ]
    `);
  });

  test.skip('throws if the response is not ok', async () => {
    const { fetch, users } = buildClient();

    fetch.mockImplementation(() => {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      };
    });

    expect(users.getOne()).rejects.toThrow(new XataError('Not Found', 404));
  });

  test.skip('throws with the error from the server if the response is not ok', async () => {
    const { fetch, users } = buildClient();

    fetch.mockImplementation(() => {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Resource not found' })
      };
    });

    expect(users.getOne()).rejects.toThrow(new XataError('Resource not found', 404));
  });

  test('returns the json body if the response is ok', async () => {
    const { fetch, users } = buildClient();

    const json = { a: 1 };
    fetch.mockReset().mockImplementation(() => {
      return {
        ok: true,
        json: async () => ({
          records: [json],
          meta: { page: { cursor: '', more: false } }
        })
      };
    });

    const result = await users.getOne();
    expect(result).toEqual(json);
  });
});

type ExpectedRequest = {
  method: string;
  path: string;
  body: unknown;
};

async function expectRequest(
  fetch: jest.Mock<any, any>,
  expectedRequest: ExpectedRequest[] | ExpectedRequest,
  callback: () => void,
  response?: any
) {
  fetch.mockReset().mockImplementation(() => {
    return {
      ok: true,
      json: async () => response
    };
  });

  await callback();

  const { calls } = fetch.mock;

  const requests = Array.isArray(expectedRequest) ? expectedRequest : [expectedRequest];

  expect(calls.length).toBe(requests.length);

  for (let i = 0; i < calls.length; i++) {
    const [method, path, body] = calls[i] as any;
    expect(method).toBe(requests[i].method);
    expect(path).toBe(requests[i].path);
    expect(JSON.stringify(body)).toBe(JSON.stringify(requests[i].body));
  }
}

describe('query', () => {
  describe('getMany', () => {
    test.skip('simple query', async () => {
      const { fetch, users } = buildClient();

      const expected = { method: 'POST', path: '/tables/users/query', body: {} };
      expectRequest(fetch, expected, () => users.getMany(), {
        records: [],
        meta: { page: { cursor: '', more: false } }
      });
    });

    test.skip('query with one filter', async () => {
      const { fetch, users } = buildClient();

      const expected = { method: 'POST', path: '/tables/users/query', body: { filter: { $all: [{ name: 'foo' }] } } };
      expectRequest(fetch, expected, () => users.filter('name', 'foo').getMany(), {
        records: [],
        meta: { page: { cursor: '', more: false } }
      });
    });
  });

  describe('getOne', () => {
    test.skip('returns a single object', async () => {
      const { fetch, users } = buildClient();

      const result = { records: [{ id: '1234' }], meta: { page: { cursor: '', more: false } } };
      const expected = { method: 'POST', path: '/tables/users/query', body: { page: { size: 1 } } };
      expectRequest(
        fetch,
        expected,
        async () => {
          const first = await users.select().getOne();
          expect(first?.id).toBe(result.records[0].id);
        },
        result
      );
    });

    test.skip('returns null if no objects are returned', async () => {
      const { fetch, users } = buildClient();

      const result = { records: [], meta: { page: { cursor: '', more: false } } };
      const expected = { method: 'POST', path: '/tables/users/query', body: { page: { size: 1 } } };
      expectRequest(
        fetch,
        expected,
        async () => {
          const first = await users.getOne();
          expect(first).toBeNull();
        },
        result
      );
    });
  });
});

describe('read', () => {
  test.skip('reads an object by id successfully', async () => {
    const { fetch, users } = buildClient();

    const id = 'rec_1234';
    const expected = { method: 'GET', path: `/tables/users/data/${id}`, body: undefined };
    expectRequest(fetch, expected, () => users.read(id));
  });
});

describe('Repository.update', () => {
  test.skip('updates and object successfully', async () => {
    const { fetch, users } = buildClient();

    const object = { id: 'rec_1234', xata: { version: 1 }, name: 'Ada' } as User;
    const expected = { method: 'PUT', path: `/tables/users/data/${object.id}`, body: object };
    expectRequest(
      fetch,
      expected,
      async () => {
        const result = await users.update(object.id, object);
        expect(result.id).toBe(object.id);
      },
      { id: object.id }
    );
  });
});

describe('Repository.delete', () => {
  test.skip('deletes a record by id successfully', async () => {
    const { fetch, users } = buildClient();

    const id = 'rec_1234';
    const expected = { method: 'DELETE', path: `/tables/users/data/${id}`, body: undefined };
    expectRequest(fetch, expected, async () => {
      const result = await users.delete(id);
      expect(result).toBe(undefined);
    });
  });
});

describe('create', () => {
  test.skip('successful', async () => {
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

    expectRequest(
      fetch,
      expected,
      async () => {
        const result = await users.create(object);
        expect(result.id).toBe(created.id);
      },
      created
    );
  });
});
