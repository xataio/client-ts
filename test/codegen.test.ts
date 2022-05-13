import * as fs from 'fs/promises';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateFromLocalFiles } from '../codegen/src/local';

vi.mock('fs/promises', async () => {
  const realFs: typeof fs = await vi.importActual('fs/promises');
  return { ...realFs, writeFile: vi.fn() };
});

afterEach(() => {
  vi.clearAllMocks();
});

const writeFileMock = fs.writeFile as unknown as ReturnType<typeof vi.fn>['mock'];

const xataDirectory = join(__dirname, 'mocks');

describe('generateFromLocalFiles', () => {
  it('should generate correct TypeScript', async () => {
    const outputFilePath = 'example.ts';
    await generateFromLocalFiles(xataDirectory, outputFilePath);
    expect(writeFileMock.calls.map((item) => item[1])).toMatchSnapshot();
  });

  it('should generate correct JavaScript', async () => {
    const outputFilePath = 'example.js';
    await generateFromLocalFiles(xataDirectory, outputFilePath);
    expect(writeFileMock.calls.map((item) => item[1])).toMatchSnapshot();
  });
});
