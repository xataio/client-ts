import { Config } from '@oclif/core';
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import process from 'process';
import prompts from 'prompts';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import which from 'which';
import { isIgnored } from '../../git';
import { runInTempDir } from '../../utils/testFsUtils';
import { clearEnvVariables } from '../utils.test.js';
import Init from './index.js';

vi.mock('prompts');
vi.mock('node-fetch');
vi.mock('which');
vi.mock('child_process');
vi.mock('../../git');

clearEnvVariables();

beforeEach(() => {
  process.env.XATA_API_KEY = '1234abcdef';
  process.env.XATA_BRANCH = 'main';
});

afterEach(() => {
  vi.clearAllMocks();
});

const PACKAGE_JSON = JSON.stringify({
  name: 'test',
  version: '1.0.0'
});

const REGION = 'us-east-1';
const fetchImplementation = (url: string, request: any) => {
  if (url === 'https://api.xata.io/workspaces' && request.method === 'GET') {
    return {
      ok: true,
      json: async () => ({
        workspaces: [{ id: 'test-1234', name: 'test-1234' }]
      })
    };
  } else if (url === 'https://api.xata.io/workspaces/test-1234/dbs' && request.method === 'GET') {
    return {
      ok: true,
      json: async () => ({
        databases: [{ name: 'db1', region: REGION }]
      })
    };
  } else if (url === `https://test-1234.${REGION}.xata.sh/db/db1:main` && request.method === 'GET') {
    return {
      ok: true,
      json: async () => ({ schema: { tables: [{ name: 'table1', columns: [{ name: 'a', type: 'string' }] }] } })
    };
  } else if (url === `https://test-1234.${REGION}.xata.sh/db/db1:main/schema/history` && request.method === 'POST') {
    return {
      ok: true,
      json: async () => ({ meta: { cursor: '', more: false }, logs: [] })
    };
  } else if (url === `https://test-1234.${REGION}.xata.sh/dbs/db1` && request.method === 'GET') {
    return {
      ok: true,
      json: async () => {
        return {
          branches: [{ name: 'main', id: 'main' }]
        };
      }
    };
  }
  throw new Error(`Unexpected fetch request: ${url} ${request.method}`);
};

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
const promptsMock = prompts as unknown as ReturnType<typeof vi.fn>;
const isGitIgnoredMock = isIgnored as unknown as ReturnType<typeof vi.fn>;
const spawnMock = spawn as unknown as ReturnType<typeof vi.fn>;

const runInitTest = async (
  files: Record<string, string>,
  args: string[] = [],
  prompts: Record<string, any> = { workspace: 'test-1234', database: 'db1' },
  setupCommand: (command: Init) => void = () => null
) => {
  fetchMock.mockImplementation(fetchImplementation);
  promptsMock.mockReturnValue(prompts);

  const config = await Config.load();

  const { outputFiles, log, warn } = await runInTempDir(files, async () => {
    const command = new Init(['--no-delay', ...args], config);
    const log = vi.spyOn(command, 'log');
    const warn = vi.spyOn(command, 'warn');

    setupCommand(command);

    await command.init();
    await command.run();
    return { log, warn };
  });

  return { log, warn, promptsMock, outputFiles };
};

describe('xata init', () => {
  test('errors when .xatarc already exists', async () => {
    await expect(
      runInitTest({ '.xatarc': '{}' }, [], { workspace: 'test-1234', database: 'db1', gitIgnore: false }, (command) => {
        command.projectConfigLocation = '.xatarc';
      })
    ).rejects.toMatch(/.*Project already configured.*/);
  });

  test('creates .xatarc', async () => {
    const files: Record<string, string> = {
      'readme.md': ''
    };
    const { log, outputFiles } = await runInitTest(files);
    expect(log.mock.calls.flat()).toContain('Created Xata config: .xatarc');
    expect(outputFiles['.xatarc']).toMatchInlineSnapshot(`
      "{
        "databaseURL": "https://test-1234.us-east-1.xata.sh/db/db1"
      }"
    `);
  });

  test('generates typescript types', async () => {
    const files: Record<string, string> = {
      './readme.md': '',
      './package.json': PACKAGE_JSON
    };
    vi.spyOn(which, 'sync').mockImplementation(() => '/usr/bin/pnpm');
    spawnMock.mockReturnValue({ on: (string: any, func: any) => func(0) });
    const { outputFiles, promptsMock } = await runInitTest(files, [], {
      workspace: 'test-1234',
      database: 'db1',
      codegen: 'ts',
      file: 'src/xataCustom.ts',
      declarations: true,
      packageManagerName: 'pnpm'
    });

    expect(spawnMock.mock.calls[0].slice(0, 2).flat().join(' ')).toEqual('/usr/bin/pnpm add @xata.io/client');
    expect(promptsMock.mock.calls.flat().find((p) => p.name === 'packageManagerName')).toBeTruthy();
    expect(outputFiles).toMatchInlineSnapshot(`
      {
        ".env": "# [Xata] Configuration used by the CLI and the SDK
      # Make sure your framework/tooling loads this file on startup to have it available for the SDK
      XATA_BRANCH=main
      XATA_API_KEY=1234abcdef
      ",
        ".xatarc": "{
        "databaseURL": "https://test-1234.us-east-1.xata.sh/db/db1",
        "codegen": {
          "output": "src/xataCustom.ts"
        }
      }",
        "package.json": "{"name":"test","version":"1.0.0"}",
        "readme.md": "",
        "xataCustom.ts": "// Generated by Xata Codegen 0.29.2. Please do not edit.
      import { buildClient } from "@xata.io/client";
      import type {
        BaseClientOptions,
        SchemaInference,
        XataRecord,
      } from "@xata.io/client";

      const tables = [
        { name: "table1", columns: [{ name: "a", type: "string" }] },
      ] as const;

      export type SchemaTables = typeof tables;
      export type InferredTypes = SchemaInference<SchemaTables>;

      export type Table1 = InferredTypes["table1"];
      export type Table1Record = Table1 & XataRecord;

      export type DatabaseSchema = {
        table1: Table1Record;
      };

      const DatabaseClient = buildClient();

      const defaultOptions = {
        databaseURL: "https://test-1234.us-east-1.xata.sh/db/db1",
      };

      export class XataClient extends DatabaseClient<DatabaseSchema> {
        constructor(options?: BaseClientOptions) {
          super({ ...defaultOptions, ...options }, tables);
        }
      }

      let instance: XataClient | undefined = undefined;

      export const getXataClient = () => {
        if (instance) return instance;

        instance = new XataClient();
        return instance;
      };
      ",
      }
    `);
  });

  test('warns user if no package.json', async () => {
    const files: Record<string, string> = {
      './readme.md': ''
    };
    vi.spyOn(which, 'sync').mockImplementation(() => '/usr/bin/pnpm');
    spawnMock.mockReturnValue({ on: (string: any, func: any) => func(0) });
    const { warn, outputFiles, promptsMock } = await runInitTest(files, [], {
      workspace: 'test-1234',
      database: 'db1',
      codegen: 'ts',
      file: 'src/xataCustom.ts',
      declarations: true
    });

    expect(spawnMock.mock.calls.length).toBe(0);
    expect(promptsMock.mock.calls.flat().find((p) => p.name === 'packageManagerName')).toBeFalsy();
    expect(warn.mock.calls.flat()).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'No package.json found. Please run one of: pnpm init, yarn init, npm init, bun init. Then rerun'
        )
      ])
    );

    expect(outputFiles).toMatchInlineSnapshot(`
      {
        ".env": "# [Xata] Configuration used by the CLI and the SDK
      # Make sure your framework/tooling loads this file on startup to have it available for the SDK
      XATA_BRANCH=main
      XATA_API_KEY=1234abcdef
      ",
        ".xatarc": "{
        "databaseURL": "https://test-1234.us-east-1.xata.sh/db/db1",
        "codegen": {
          "output": "src/xataCustom.ts"
        }
      }",
        "readme.md": "",
        "xataCustom.ts": "// Generated by Xata Codegen 0.29.2. Please do not edit.
      import { buildClient } from "@xata.io/client";
      import type {
        BaseClientOptions,
        SchemaInference,
        XataRecord,
      } from "@xata.io/client";

      const tables = [
        { name: "table1", columns: [{ name: "a", type: "string" }] },
      ] as const;

      export type SchemaTables = typeof tables;
      export type InferredTypes = SchemaInference<SchemaTables>;

      export type Table1 = InferredTypes["table1"];
      export type Table1Record = Table1 & XataRecord;

      export type DatabaseSchema = {
        table1: Table1Record;
      };

      const DatabaseClient = buildClient();

      const defaultOptions = {
        databaseURL: "https://test-1234.us-east-1.xata.sh/db/db1",
      };

      export class XataClient extends DatabaseClient<DatabaseSchema> {
        constructor(options?: BaseClientOptions) {
          super({ ...defaultOptions, ...options }, tables);
        }
      }

      let instance: XataClient | undefined = undefined;

      export const getXataClient = () => {
        if (instance) return instance;

        instance = new XataClient();
        return instance;
      };
      ",
      }
    `);
  });

  test(`deno doesn't install packages`, async () => {
    const files: Record<string, string> = {
      './readme.md': ''
    };
    vi.spyOn(which, 'sync').mockImplementation(() => '/usr/bin/pnpm');
    spawnMock.mockReturnValue({ on: (string: any, func: any) => func(0) });
    const { outputFiles, promptsMock } = await runInitTest(files, [], {
      workspace: 'test-1234',
      database: 'db1',
      codegen: 'deno',
      file: 'src/xataCustom.ts',
      declarations: true
    });

    expect(promptsMock.mock.calls.flat().find((p) => p.name === 'packageManagerName')).toBeFalsy();
    expect(outputFiles).toMatchInlineSnapshot(`
      {
        ".env": "# [Xata] Configuration used by the CLI and the SDK
      # Make sure your framework/tooling loads this file on startup to have it available for the SDK
      XATA_BRANCH=main
      XATA_API_KEY=1234abcdef
      ",
        ".xatarc": "{
        "databaseURL": "https://test-1234.us-east-1.xata.sh/db/db1",
        "codegen": {
          "output": "src/xataCustom.ts",
          "moduleType": "deno"
        }
      }",
        "readme.md": "",
        "xataCustom.ts": "// Generated by Xata Codegen 0.29.2. Please do not edit.
      import { buildClient } from "npm:@xata.io/client@latest";
      import type {
        BaseClientOptions,
        SchemaInference,
        XataRecord,
      } from "npm:@xata.io/client@latest";

      const tables = [
        { name: "table1", columns: [{ name: "a", type: "string" }] },
      ] as const;

      export type SchemaTables = typeof tables;
      export type InferredTypes = SchemaInference<SchemaTables>;

      export type Table1 = InferredTypes["table1"];
      export type Table1Record = Table1 & XataRecord;

      export type DatabaseSchema = {
        table1: Table1Record;
      };

      const DatabaseClient = buildClient();

      const defaultOptions = {
        databaseURL: "https://test-1234.us-east-1.xata.sh/db/db1",
      };

      export class XataClient extends DatabaseClient<DatabaseSchema> {
        constructor(options?: BaseClientOptions) {
          super({ ...defaultOptions, ...options }, tables);
        }
      }

      let instance: XataClient | undefined = undefined;

      export const getXataClient = () => {
        if (instance) return instance;

        instance = new XataClient();
        return instance;
      };
      ",
      }
    `);
  });

  test('uses pnpm automatically if lockfile exists ', async () => {
    const files: Record<string, string> = {
      './readme.md': '',
      './package.json': PACKAGE_JSON,
      './pnpm-lock.yaml': `lockfileVersion: '6.0'`
    };
    vi.spyOn(which, 'sync').mockImplementation(() => '/usr/bin/pnpm');
    spawnMock.mockImplementation(() => ({ on: (string: any, func: any) => func(0) }));
    const { outputFiles, promptsMock } = await runInitTest(files, [], {
      workspace: 'test-1234',
      database: 'db1',
      codegen: 'ts',
      file: 'src/xataCustom.ts',
      declarations: true
    });
    expect(spawnMock.mock.calls[0].slice(0, 2).flat().join(' ')).toEqual('/usr/bin/pnpm add @xata.io/client');
    expect(promptsMock.mock.calls.flat().find((p) => p.name === 'packageManagerName')).toBeFalsy();

    expect(outputFiles).toMatchInlineSnapshot(`
      {
        ".env": "# [Xata] Configuration used by the CLI and the SDK
      # Make sure your framework/tooling loads this file on startup to have it available for the SDK
      XATA_BRANCH=main
      XATA_API_KEY=1234abcdef
      ",
        ".xatarc": "{
        "databaseURL": "https://test-1234.us-east-1.xata.sh/db/db1",
        "codegen": {
          "output": "src/xataCustom.ts"
        }
      }",
        "package.json": "{"name":"test","version":"1.0.0"}",
        "pnpm-lock.yaml": "lockfileVersion: '6.0'",
        "readme.md": "",
        "xataCustom.ts": "// Generated by Xata Codegen 0.29.2. Please do not edit.
      import { buildClient } from "@xata.io/client";
      import type {
        BaseClientOptions,
        SchemaInference,
        XataRecord,
      } from "@xata.io/client";

      const tables = [
        { name: "table1", columns: [{ name: "a", type: "string" }] },
      ] as const;

      export type SchemaTables = typeof tables;
      export type InferredTypes = SchemaInference<SchemaTables>;

      export type Table1 = InferredTypes["table1"];
      export type Table1Record = Table1 & XataRecord;

      export type DatabaseSchema = {
        table1: Table1Record;
      };

      const DatabaseClient = buildClient();

      const defaultOptions = {
        databaseURL: "https://test-1234.us-east-1.xata.sh/db/db1",
      };

      export class XataClient extends DatabaseClient<DatabaseSchema> {
        constructor(options?: BaseClientOptions) {
          super({ ...defaultOptions, ...options }, tables);
        }
      }

      let instance: XataClient | undefined = undefined;

      export const getXataClient = () => {
        if (instance) return instance;

        instance = new XataClient();
        return instance;
      };
      ",
      }
    `);
  });

  test('creates .env', async () => {
    const files: Record<string, string> = {
      'readme.md': ''
    };
    const { log, outputFiles } = await runInitTest(files);
    expect(log.mock.calls.flat()).toContain('Creating .env file');
    expect(outputFiles['.env']).toMatchInlineSnapshot(`
      "# [Xata] Configuration used by the CLI and the SDK
      # Make sure your framework/tooling loads this file on startup to have it available for the SDK
      XATA_BRANCH=main
      XATA_API_KEY=1234abcdef
      "
    `);
  });

  test('updates .env', async () => {
    const files: Record<string, string> = {
      '.env': 'UNRELATED_ENV_VAR=123'
    };
    const { log, outputFiles } = await runInitTest(files);

    expect(log.mock.calls.flat()).toContain('Updating .env file');
    expect(outputFiles['.env']).toMatchInlineSnapshot(`
      "UNRELATED_ENV_VAR=123

      # [Xata] Configuration used by the CLI and the SDK
      # Make sure your framework/tooling loads this file on startup to have it available for the SDK
      XATA_BRANCH=main
      XATA_API_KEY=1234abcdef
      "
    `);
  });

  test('git ignore prompt true creates .gitignore', async () => {
    const files: Record<string, string> = {
      '.env': 'UNRELATED_ENV_VAR=123'
    };
    isGitIgnoredMock.mockReturnValue(false);
    const { log, outputFiles } = await runInitTest(files, [], {
      workspace: 'test-1234',
      database: 'db1',
      gitIgnore: true
    });

    expect(log.mock.calls.flat()).toContain('Added .env file to .gitignore');
    expect(outputFiles['.gitignore']).toMatchInlineSnapshot(`
      ".env
      "
    `);
  });

  test('git ignore prompt false does not create .gitignore', async () => {
    const files: Record<string, string> = {
      '.env': 'UNRELATED_ENV_VAR=123'
    };
    isGitIgnoredMock.mockReturnValue(false);
    const { outputFiles } = await runInitTest(files, [], { workspace: 'test-1234', database: 'db1', gitIgnore: false });

    expect(outputFiles['.gitignore']).toBeUndefined();
  });

  test('already git ignored does not update .gitignore', async () => {
    const files: Record<string, string> = {
      '.env': 'UNRELATED_ENV_VAR=123',
      '.gitignore': 'node_modules\n.env'
    };
    isGitIgnoredMock.mockReturnValue(true);
    const { outputFiles } = await runInitTest(files, [], { workspace: 'test-1234', database: 'db1', gitIgnore: true });

    expect(outputFiles['.gitignore']).toEqual(files['.gitignore']);
  });

  test('git ignore prompt true updates .gitignore', async () => {
    const files: Record<string, string> = {
      '.env': 'UNRELATED_ENV_VAR=123',
      '.gitignore': 'node_modules'
    };
    isGitIgnoredMock.mockReturnValue(false);
    const { log, outputFiles } = await runInitTest(files, [], {
      workspace: 'test-1234',
      database: 'db1',
      gitIgnore: true
    });

    expect(log.mock.calls.flat()).toContain('Added .env file to .gitignore');
    expect(outputFiles['.gitignore']).toMatchInlineSnapshot(`
      "node_modules

      .env
      "
    `);
  });

  test('git ignore prompt false does not update .gitignore', async () => {
    const files: Record<string, string> = {
      '.env': 'UNRELATED_ENV_VAR=123',
      '.gitignore': 'node_modules'
    };
    isGitIgnoredMock.mockReturnValue(false);
    const { outputFiles } = await runInitTest(files, [], { workspace: 'test-1234', database: 'db1', gitIgnore: false });

    expect(outputFiles['.gitignore']).toMatchInlineSnapshot(`
    "node_modules"
      `);
  });
});
