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
          "body": "{\\"page\\":{\\"size\\":1},\\"columns\\":[\\"*\\"]}",
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
          "body": "{\\"page\\":{\\"size\\":1},\\"columns\\":[\\"*\\"]}",
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
          "body": "{\\"page\\":{\\"size\\":1},\\"columns\\":[\\"*\\"]}",
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
          "body": "{\\"page\\":{\\"size\\":1},\\"columns\\":[\\"*\\"]}",
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
          "body": "{\\"page\\":{\\"size\\":20},\\"columns\\":[\\"*\\"]}",
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

  test('throws if the response is not ok', async () => {
    const { fetch, users } = buildClient();

    fetch.mockReset().mockImplementation(async () => {
      return {
        ok: false,
        status: 404,
        json: async () => ({ message: 'Not Found' })
      };
    });

    expect(users.getOne()).rejects.toThrowErrorMatchingInlineSnapshot(`"Not Found"`);
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
  body?: unknown;
};

async function expectRequest(
  fetch: jest.Mock<any, any>,
  expectedRequest: ExpectedRequest[] | ExpectedRequest,
  callback: () => void,
  response?: any
): Promise<any[]> {
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

  return calls;
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
        Array [
          Array [
            "https://my-workspace-5df34do.staging.xatabase.co/db/xata:main/tables/users/query",
            Object {
              "body": "{\\"columns\\":[\\"*\\"]}",
              "headers": Object {
                "Authorization": "Bearer 1234",
                "Content-Type": "application/json",
                "Host": "my-workspace-5df34do.staging.xatabase.co",
              },
              "method": "POST",
            },
          ],
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
        Array [
          Array [
            "https://my-workspace-5df34do.staging.xatabase.co/db/xata:main/tables/users/query",
            Object {
              "body": "{\\"filter\\":{\\"$all\\":[{\\"name\\":\\"foo\\"}]},\\"columns\\":[\\"*\\"]}",
              "headers": Object {
                "Authorization": "Bearer 1234",
                "Content-Type": "application/json",
                "Host": "my-workspace-5df34do.staging.xatabase.co",
              },
              "method": "POST",
            },
          ],
        ]
      `);
    });
  });

  describe('getOne', () => {
    test('returns a single object', async () => {
      const { fetch, users } = buildClient();

      const resultBody = { records: [{ id: '1234' }], meta: { page: { cursor: '', more: false } } };
      const expected = { method: 'POST', path: '/tables/users/query', body: { page: { size: 1 } } };
      const result = await expectRequest(
        fetch,
        expected,
        async () => {
          const first = await users.getOne();
          expect(first?.id).toBe(resultBody.records[0].id);
        },
        resultBody
      );

      expect(result).toMatchInlineSnapshot(`
        Array [
          Array [
            "https://my-workspace-5df34do.staging.xatabase.co/db/xata:main/tables/users/query",
            Object {
              "body": "{\\"page\\":{\\"size\\":1},\\"columns\\":[\\"*\\"]}",
              "headers": Object {
                "Authorization": "Bearer 1234",
                "Content-Type": "application/json",
                "Host": "my-workspace-5df34do.staging.xatabase.co",
              },
              "method": "POST",
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
          const first = await users.getOne();
          expect(first).toBeNull();
        },
        { records: [], meta: { page: { cursor: '', more: false } } }
      );

      expect(result).toMatchInlineSnapshot(`
        Array [
          Array [
            "https://my-workspace-5df34do.staging.xatabase.co/db/xata:main/tables/users/query",
            Object {
              "body": "{\\"page\\":{\\"size\\":1},\\"columns\\":[\\"*\\"]}",
              "headers": Object {
                "Authorization": "Bearer 1234",
                "Content-Type": "application/json",
                "Host": "my-workspace-5df34do.staging.xatabase.co",
              },
              "method": "POST",
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
      Array [
        Array [
          "https://my-workspace-5df34do.staging.xatabase.co/db/xata:main/tables/users/data/rec_1234",
          Object {
            "body": undefined,
            "headers": Object {
              "Authorization": "Bearer 1234",
              "Content-Type": "application/json",
              "Host": "my-workspace-5df34do.staging.xatabase.co",
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
      Array [
        Array [
          "https://my-workspace-5df34do.staging.xatabase.co/db/xata:main/tables/users/data/rec_1234",
          Object {
            "body": "{\\"id\\":\\"rec_1234\\",\\"xata\\":{\\"version\\":1},\\"name\\":\\"Ada\\"}",
            "headers": Object {
              "Authorization": "Bearer 1234",
              "Content-Type": "application/json",
              "Host": "my-workspace-5df34do.staging.xatabase.co",
            },
            "method": "PATCH",
          },
        ],
        Array [
          "https://my-workspace-5df34do.staging.xatabase.co/db/xata:main/tables/users/data/rec_1234",
          Object {
            "body": undefined,
            "headers": Object {
              "Authorization": "Bearer 1234",
              "Content-Type": "application/json",
              "Host": "my-workspace-5df34do.staging.xatabase.co",
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
      Array [
        Array [
          "https://my-workspace-5df34do.staging.xatabase.co/db/xata:main/tables/users/data/rec_1234",
          Object {
            "body": undefined,
            "headers": Object {
              "Authorization": "Bearer 1234",
              "Content-Type": "application/json",
              "Host": "my-workspace-5df34do.staging.xatabase.co",
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
      Array [
        Array [
          "https://my-workspace-5df34do.staging.xatabase.co/db/xata:main/tables/users/data",
          Object {
            "body": "{\\"name\\":\\"Ada\\"}",
            "headers": Object {
              "Authorization": "Bearer 1234",
              "Content-Type": "application/json",
              "Host": "my-workspace-5df34do.staging.xatabase.co",
            },
            "method": "POST",
          },
        ],
        Array [
          "https://my-workspace-5df34do.staging.xatabase.co/db/xata:main/tables/users/data/rec_1234",
          Object {
            "body": undefined,
            "headers": Object {
              "Authorization": "Bearer 1234",
              "Content-Type": "application/json",
              "Host": "my-workspace-5df34do.staging.xatabase.co",
            },
            "method": "GET",
          },
        ],
      ]
    `);
  });
});
