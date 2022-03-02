import { BaseClient, RestRepository, XataError, XataRecord } from './';

const fetch = jest.fn();
const client = new BaseClient(
  {
    fetch,
    apiKey: '1234',
    databaseURL: 'https://my-workspace-5df34do.staging.xatabase.co/db/xata:main'
  },
  {}
);

interface User extends XataRecord {
  name: string;
}

const users = new RestRepository<User>(client, 'users');

describe('client', () => {
  test('api key option is set', () => {
    const client = new BaseClient({ apiKey: 'apiKey', databaseURL: 'url' }, {});
    expect(client.options.apiKey).toBe('apiKey');
    expect(client.options.databaseURL).toBe('url');
  });

  test('throws if mandatory options are missing', () => {
    // @ts-expect-error Options are mandatory in TypeScript
    expect(() => new BaseClient({ apiKey: null, databaseURL: null }, {})).toThrow(
      'Options databaseURL and apiKey are required'
    );
  });
});

describe('request', () => {
  test('builds the right arguments for a GET request', async () => {
    fetch.mockReset().mockImplementation(() => {
      return {
        ok: true,
        json: async () => ({})
      };
    });

    users.request('GET', '/foo');

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]).toMatchInlineSnapshot(`
      Array [
        "https://my-workspace-5df34do.staging.xatabase.co/db/xata:main/foo",
        Object {
          "body": undefined,
          "headers": Object {
            "Accept": "*/*",
            "Authorization": "Bearer 1234",
            "Content-Type": "application/json",
          },
          "method": "GET",
        },
      ]
    `);
  });

  test('builds the right arguments for a POST request', async () => {
    fetch.mockReset().mockImplementation(() => {
      return {
        ok: true,
        json: async () => ({})
      };
    });

    users.request('POST', '/foo', { a: 1 });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]).toMatchInlineSnapshot(`
      Array [
        "https://my-workspace-5df34do.staging.xatabase.co/db/xata:main/foo",
        Object {
          "body": "{\\"a\\":1}",
          "headers": Object {
            "Accept": "*/*",
            "Authorization": "Bearer 1234",
            "Content-Type": "application/json",
          },
          "method": "POST",
        },
      ]
    `);
  });

  test('throws if the response is not ok', async () => {
    fetch.mockImplementation(() => {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      };
    });

    expect(users.request('GET', '/foo')).rejects.toThrow(new XataError('Not Found', 404));
  });

  test('throws with the error from the server if the response is not ok', async () => {
    fetch.mockImplementation(() => {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Resource not found' })
      };
    });

    expect(users.request('GET', '/foo')).rejects.toThrow(new XataError('Resource not found', 404));
  });

  test('returns the json body if the response is ok', async () => {
    const json = { a: 1 };
    fetch.mockImplementation(() => {
      return {
        ok: true,
        json: async () => json
      };
    });

    const result = await users.request('GET', '/foo');
    expect(result).toEqual(json);
  });
});

type ExpectedRequest = {
  method: string;
  path: string;
  body: unknown;
};

async function expectRequest(expectedRequest: ExpectedRequest, callback: () => void, response?: unknown) {
  const request = jest.fn(async () => response);
  users.request = request;

  await callback();

  const { calls } = request.mock;
  expect(calls.length).toBe(1);
  const [method, path, body] = calls[0] as any;
  expect(method).toBe(expectedRequest.method);
  expect(path).toBe(expectedRequest.path);
  expect(JSON.stringify(body)).toBe(JSON.stringify(expectedRequest.body));
}

describe('query', () => {
  describe('getMany', () => {
    test('simple query', async () => {
      const expected = { method: 'POST', path: '/tables/users/query', body: {} };
      expectRequest(expected, () => users.getMany(), { records: [] });
    });

    test('query with one filter', async () => {
      const expected = { method: 'POST', path: '/tables/users/query', body: { filter: { $all: [{ name: 'foo' }] } } };
      expectRequest(expected, () => users.filter('name', 'foo').getMany(), { records: [] });
    });
  });

  describe('getOne', () => {
    test('returns a single object', async () => {
      const result = { records: [{ id: '1234' }] };
      const expected = { method: 'POST', path: '/tables/users/query', body: {} };
      expectRequest(
        expected,
        async () => {
          const first = await users.select().getOne();
          expect(first?.id).toBe(result.records[0].id);
        },
        result
      );
    });

    test('returns null if no objects are returned', async () => {
      const result = { records: [] };
      const expected = { method: 'POST', path: '/tables/users/query', body: {} };
      expectRequest(
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
  test('reads an object by id successfully', async () => {
    const id = 'rec_1234';
    const expected = { method: 'GET', path: `/tables/users/data/${id}`, body: undefined };
    expectRequest(expected, () => users.read(id));
  });
});

describe('Repository.update', () => {
  test('updates and object successfully', async () => {
    const object = { id: 'rec_1234', xata: { version: 1 }, name: 'Ada' } as User;
    const expected = { method: 'PUT', path: `/tables/users/data/${object.id}`, body: object };
    expectRequest(
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
  test('deletes a record by id successfully', async () => {
    const id = 'rec_1234';
    const expected = { method: 'DELETE', path: `/tables/users/data/${id}`, body: undefined };
    expectRequest(expected, async () => {
      const result = await users.delete(id);
      expect(result).toBe(undefined);
    });
  });
});

describe('create', () => {
  test('successful', async () => {
    const created = { id: 'rec_1234', _version: 0 };
    const object = { name: 'Ada' } as User;
    const expected = { method: 'POST', path: '/tables/users/data', body: object };
    expectRequest(
      expected,
      async () => {
        const result = await users.create(object);
        expect(result.id).toBe(created.id);
      },
      created
    );
  });
});
