import { afterEach, describe, expect, it, vi } from 'vitest';
import { generate } from '../packages/codegen/src/codegen';
import { VERSION as CODEGEN_VERSION } from '../packages/codegen/src/version';

afterEach(() => {
  vi.clearAllMocks();
});

describe('generate', () => {
  it('should respect numbers in names', async () => {
    const output = await generate({
      schema: {
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
      databaseURL: 'https://workspace-1234.xata.sh/db/dbname'
    });

    expect(stableVersion(output.typescript)).toMatchSnapshot();
    expect(stableVersion(output.javascript)).toMatchSnapshot();
    expect(stableVersion(output.types ?? '')).toMatchSnapshot();
  });

  it('should respect case naming', async () => {
    const output = await generate({
      schema: {
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
      databaseURL: 'https://workspace-1234.xata.sh/db/dbname'
    });

    expect(stableVersion(output.typescript)).toMatchSnapshot();
  });

  it('should inject branch if passed', async () => {
    const output = await generate({
      schema: {
        tables: [
          {
            name: 'users',
            columns: [{ name: 'name', type: 'string' }]
          }
        ]
      },
      language: 'typescript',
      databaseURL: 'https://workspace-1234.xata.sh/db/dbname',
      branch: 'feature-branch'
    });

    expect(stableVersion(output.typescript)).toMatchSnapshot();
  });

  it('should generate CJS code', async () => {
    const output = await generate({
      schema: {
        tables: [
          {
            name: 'users',
            columns: [{ name: 'name', type: 'string' }]
          }
        ]
      },
      language: 'javascript',
      moduleType: 'cjs',
      databaseURL: 'https://workspace-1234.xata.sh/db/dbname',
      branch: 'feature-branch'
    });

    expect(stableVersion(output.javascript)).toMatchSnapshot();
  });

  it('should ignore CJS for TS code', async () => {
    const output = await generate({
      schema: {
        tables: [
          {
            name: 'users',
            columns: [{ name: 'name', type: 'string' }]
          }
        ]
      },
      language: 'typescript',
      moduleType: 'cjs',
      databaseURL: 'https://workspace-1234.xata.sh/db/dbname',
      branch: 'feature-branch'
    });

    expect(stableVersion(output.typescript)).toMatchSnapshot();
  });

  it('should generate Deno code', async () => {
    const output = await generate({
      schema: {
        tables: [
          {
            name: 'users',
            columns: [{ name: 'name', type: 'string' }]
          }
        ]
      },
      language: 'typescript',
      moduleType: 'deno',
      databaseURL: 'https://workspace-1234.xata.sh/db/dbname',
      branch: 'feature-branch'
    });

    expect(stableVersion(output.typescript)).toMatchSnapshot();
  });
});

// This method will replace the current version of the codegen with a placeholder so snapshots don't change
// if we just bump the codegen version
function stableVersion(code: string) {
  return code.replace(
    `Generated by Xata Codegen ${CODEGEN_VERSION}. Please do not edit`,
    'Generated by Xata Codegen CODEGEN_VERSION. Please do not edit'
  );
}
