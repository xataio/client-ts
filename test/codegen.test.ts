import * as fs from 'fs/promises';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generate } from '../packages/codegen/src/codegen';

vi.mock('fs/promises', async () => {
  const realFs: typeof fs = await vi.importActual('fs/promises');
  return { ...realFs, writeFile: vi.fn() };
});

afterEach(() => {
  vi.clearAllMocks();
});

const writeFileMock = fs.writeFile as unknown as ReturnType<typeof vi.fn>['mock'];

const xataDirectory = join(__dirname, 'mocks');

describe('generate', () => {
  it('should respect numbers in names', async () => {
    const output = await generate({
      schema: {
        formatVersion: '1.0',
        tables: [
          {
            name: '1teams-case',
            columns: [
              { name: '2nameCase', type: 'string' },
              { name: '3Labels', type: 'multiple' }
            ]
          }
        ]
      },
      language: 'typescript',
      databaseURL: ''
    });

    expect(output.transpiled).toMatchSnapshot();
  });

  it('should respect case naming', async () => {
    const output = await generate({
      schema: {
        formatVersion: '1.0',
        tables: [
          {
            name: 'teams_Like',
            columns: [
              { name: 'name-test', type: 'string' },
              { name: 'labels_Test', type: 'multiple' },
              { name: 'ownerFoo', type: 'link', link: { table: 'users-foo' } }
            ]
          },
          {
            name: 'users-foo',
            columns: [
              { name: 'email-random', type: 'email' },
              { name: 'full_name', type: 'string' },
              { name: 'teamLike', type: 'link', link: { table: 'teams_Like' } }
            ]
          }
        ]
      },
      language: 'typescript',
      databaseURL: ''
    });

    expect(output.transpiled).toMatchSnapshot();
  });
});
