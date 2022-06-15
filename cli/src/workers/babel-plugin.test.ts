import babel from '@babel/core';
import { afterEach, describe, expect, test, vi } from 'vitest';
import plugin from './babel-plugin.js';
import fs from 'fs';

vi.mock('fs');

const writeFileSyncMock = fs.writeFileSync as unknown as ReturnType<typeof vi.fn>;

const options = { clientPath: 'xata.ts', output: '/output', root: '/client' };

afterEach(() => {
  vi.clearAllMocks();
});

describe('babel plugin', () => {
  test('no xata workers', async () => {
    const code = `
var foo = 1;
if (foo) console.log(foo);
`;

    babel.transformSync(code, { filename: 'source.js', plugins: [[plugin, options]] });

    expect(writeFileSyncMock.mock.calls[0]).toMatchSnapshot();
  });

  test('a simple xata worker', async () => {
    const code = `

xataWorker(async function helloWorld() {
  return 'Hello world';
})

`;

    babel.transformSync(code, { filename: 'source.js', plugins: [[plugin, options]] });

    expect(writeFileSyncMock.mock.calls[0]).toMatchSnapshot();
  });

  test('a xata worker with arguments', async () => {
    const code = `

xataWorker(async function paginatedResult(page) {
  return page;
})

`;

    babel.transformSync(code, { filename: 'source.js', plugins: [[plugin, options]] });

    expect(writeFileSyncMock.mock.calls[0]).toMatchSnapshot();
  });

  test('a xata worker with an external module dependency', async () => {
    const code = `
import camelCase from 'camelcase';

xataWorker(async function camelCasedHelloWorld() {
  return camelCase('Hello world');
})

`;

    babel.transformSync(code, { filename: 'source.js', plugins: [[plugin, options]] });

    expect(writeFileSyncMock.mock.calls[0]).toMatchSnapshot();
  });

  test('a xata worker with a local dependency', async () => {
    const code = `
import dep from './dep.js';

xataWorker(async function localDependency() {
  return dep.doSomething();
})

`;

    babel.transformSync(code, { filename: 'source.js', plugins: [[plugin, options]] });

    expect(writeFileSyncMock.mock.calls[0]).toMatchSnapshot();
  });
});
