import { Config } from '@oclif/core';
import fetch from 'node-fetch';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { clearEnvVariables } from '../utils.test.js';
import prompts from 'prompts';
import MigrateList from './list.js';
import { baseFetch } from './utils.test.js';

vi.mock('prompts');
vi.mock('node-fetch');
vi.mock('fs/promises');

clearEnvVariables();

beforeEach(() => {
  process.env.XATA_API_KEY = '1234abcdef';
  process.env.XATA_BRANCH = 'main';
});

const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
const promptsMock = prompts as unknown as ReturnType<typeof vi.fn>;

const REGION = 'us-east-1';
const baseUrl = `https://test-1234.${REGION}.xata.sh/db/db1:main`;

const fetchHistoryEmpty = (url: string, request: any) => {
  if (url === `${baseUrl}/migrations/history?limit=10` && request.method === 'GET') {
    return {
      ok: true,
      json: async () => {
        return {
          // History is never really empty, at least it has CREATE SCHEMA
          migrations: [
            {
              done: true,
              migration:
                '{"name": "mig_cqf8cl6ma8p2licooa7g", "operations": [{"sql": {"up": "CREATE SCHEMA \\"bb_00000000000000000000000000_000000\\";"}}]}',
              migrationType: 'pgroll',
              name: 'mig_cqf8cl6ma8p2licooa7g',
              schema: 'public',
              startedAt: '2024-07-22T16:18:28.433876Z'
            }
          ]
        };
      }
    };
  } else {
    return baseFetch(url, request);
  }
};

const fetchHistoryWithItems = (url: string, request: any) => {
  if (url === `${baseUrl}/migrations/history?limit=10` && request.method === 'GET') {
    return {
      ok: true,
      json: async () => {
        return {
          migrations: [
            {
              done: true,
              migration:
                '{"name": "mig_cq406t3ehsuqih1jv810", "operations": [{"add_column": {"up": "\'\'", "table": "notes", "column": {"pk": false, "name": "url", "type": "text", "check": {"name": "notes_xata_string_length_url", "constraint": "LENGTH(\\"url\\") \u003c= 2048"}, "unique": true, "comment": "{\\"xata.type\\":\\"string\\"}", "nullable": false}}}]}',
              migrationType: 'pgroll',
              name: 'mig_cq406t3ehsuqih1jv810',
              parent: 'mig_cq3a5msek1ns1o760lh0',
              schema: 'public',
              startedAt: '2024-07-05T14:51:50.988634Z'
            },
            {
              done: true,
              migration:
                '{"name": "mig_cq3a5msek1ns1o760lh0", "operations": [{"add_column": {"table": "notes", "column": {"pk": false, "name": "quote", "type": "text", "check": {"name": "notes_xata_text_length_quote", "constraint": "OCTET_LENGTH(\\"quote\\") \u003c= 204800"}, "unique": false, "comment": "{\\"xata.type\\":\\"text\\"}", "default": "\'\'", "nullable": false}}}]}',
              migrationType: 'pgroll',
              name: 'mig_cq3a5msek1ns1o760lh0',
              parent: 'mig_cq38jlr38bs8r5nbfhf0',
              schema: 'public',
              startedAt: '2024-07-04T13:48:49.386309Z'
            },
            {
              done: true,
              migration:
                '{"name": "mig_cq38jlr38bs8r5nbfhf0", "operations": [{"add_column": {"table": "notes", "column": {"pk": false, "name": "note", "type": "text", "check": {"name": "notes_xata_text_length_note", "constraint": "OCTET_LENGTH(\\"note\\") \u003c= 204800"}, "unique": false, "comment": "{\\"xata.type\\":\\"text\\"}", "default": "\'\'", "nullable": false}}}]}',
              migrationType: 'pgroll',
              name: 'mig_cq38jlr38bs8r5nbfhf0',
              parent: 'mig_cq38hb2o6r4pdmcccscg',
              schema: 'public',
              startedAt: '2024-07-04T13:47:23.072361Z'
            },
            {
              done: true,
              migration:
                '{"name": "mig_cq38hb2o6r4pdmcccscg", "operations": [{"create_table": {"name": "notes", "columns": [{"name": "xata_id", "type": "text", "check": {"name": "notes_xata_id_length_xata_id", "constraint": "length(\\"xata_id\\") \u003c 256"}, "unique": true, "default": "\'rec_\' || xata_private.xid()", "nullable": false}, {"name": "xata_version", "type": "integer", "default": "0", "nullable": false}, {"name": "xata_createdat", "type": "timestamptz", "default": "now()", "nullable": false}, {"name": "xata_updatedat", "type": "timestamptz", "default": "now()", "nullable": false}]}}, {"sql": {"up": "ALTER TABLE \\"notes\\" REPLICA IDENTITY FULL", "onComplete": true}}, {"sql": {"up": "CREATE TRIGGER xata_maintain_metadata_trigger_pgroll\\n  BEFORE INSERT OR UPDATE\\n  ON \\"notes\\"\\n  FOR EACH ROW\\n  EXECUTE FUNCTION xata_private.maintain_metadata_trigger_pgroll()", "onComplete": true}}]}',
              migrationType: 'pgroll',
              name: 'mig_cq38hb2o6r4pdmcccscg',
              parent: 'mig_cq2jgbobsmrvmqd8mnrg',
              schema: 'public',
              startedAt: '2024-07-04T11:34:05.283458Z'
            },
            {
              done: true,
              migration:
                '{"name": "mig_cq2jgbobsmrvmqd8mnrg", "operations": [{"sql": {"up": "CREATE SCHEMA \\"bb_00000000000000000000000000_000000\\";"}}]}',
              migrationType: 'pgroll',
              name: 'mig_cq2jgbobsmrvmqd8mnrg',
              schema: 'public',
              startedAt: '2024-07-03T11:38:23.42289Z'
            }
          ]
        };
      }
    };
  } else {
    return baseFetch(url, request);
  }
};

promptsMock.mockReturnValue({ confirm: true, database: 'db1', workspace: 'test-1234' });

describe('migrate list', () => {
  test('correctly lists migration history list for a project in initial state i.e. no custom migrations', async () => {
    const config = await Config.load();
    const command = new MigrateList(['main'], config);
    const printTable = vi.spyOn(command, 'printTable');
    fetchMock.mockImplementation(fetchHistoryEmpty);
    await command.run();
    expect(printTable).toHaveBeenCalledWith(
      ['Name', 'Type', 'Status', 'Parent', 'Migration'],
      [
        [
          'mig_cqf8cl6ma8p2licooa7g',
          'pgroll',
          'complete',
          'undefined',
          '[{"sql":{"up":"CREATE SCHEMA \\"bb_00000000000000000000000000_000000\\"; (truncated...)'
        ]
      ]
    );
  });

  test('correctly lists migration history list for a project with some migrations', async () => {
    const config = await Config.load();
    const command = new MigrateList(['main'], config);
    const printTable = vi.spyOn(command, 'printTable');
    fetchMock.mockImplementation(fetchHistoryWithItems);
    await command.run();
    expect(printTable).toHaveBeenCalledWith(
      ['Name', 'Type', 'Status', 'Parent', 'Migration'],
      [
        [
          'mig_cq406t3ehsuqih1jv810',
          'pgroll',
          'complete',
          'mig_cq3a5msek1ns1o760lh0',
          '[{"add_column":{"up":"\'\'","table":"notes","column":{"pk":false,"name": (truncated...)'
        ],
        [
          'mig_cq3a5msek1ns1o760lh0',
          'pgroll',
          'complete',
          'mig_cq38jlr38bs8r5nbfhf0',
          '[{"add_column":{"table":"notes","column":{"pk":false,"name":"quote","t (truncated...)'
        ],
        [
          'mig_cq38jlr38bs8r5nbfhf0',
          'pgroll',
          'complete',
          'mig_cq38hb2o6r4pdmcccscg',
          '[{"add_column":{"table":"notes","column":{"pk":false,"name":"note","ty (truncated...)'
        ],
        [
          'mig_cq38hb2o6r4pdmcccscg',
          'pgroll',
          'complete',
          'mig_cq2jgbobsmrvmqd8mnrg',
          '[{"create_table":{"name":"notes","columns":[{"name":"xata_id","type":" (truncated...)'
        ],
        [
          'mig_cq2jgbobsmrvmqd8mnrg',
          'pgroll',
          'complete',
          'undefined',
          '[{"sql":{"up":"CREATE SCHEMA \\"bb_00000000000000000000000000_000000\\"; (truncated...)'
        ]
      ]
    );
  });
});
