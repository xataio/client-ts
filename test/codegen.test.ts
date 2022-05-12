import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { generateFromLocalFiles } from '../codegen/src/local';

const xataDirectory = join(__dirname, 'mocks');

describe('generateFromLocalFiles', () => {
  it('should generate correct TypeScript', async () => {
    const outputFilePath = 'test/example.ts';
    await deleteFile(outputFilePath);
    await generateFromLocalFiles(xataDirectory, outputFilePath);

    expect(await readFile(outputFilePath, 'utf-8')).toMatchSnapshot();
    await deleteFile(outputFilePath);
  });

  it('should generate correct JavaScript', async () => {
    const outputFilePath = 'test/example.js';
    await deleteFile(outputFilePath);
    await generateFromLocalFiles(xataDirectory, outputFilePath);

    expect(await readFile(outputFilePath, 'utf-8')).toMatchSnapshot();
    await deleteFile(outputFilePath);
    await deleteFile('test/types.d.ts');
  });
});

async function deleteFile(path: string) {
  try {
    await unlink(path);
  } catch (err) {
    if ((err as Record<string, unknown>).code === 'ENOENT') return;
    throw err;
  }
}
