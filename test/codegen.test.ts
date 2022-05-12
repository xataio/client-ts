import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { generateFromLocalFiles } from '../codegen/src/local';

const xataDirectory = join(__dirname, 'mocks');

describe('generateFromLocalFiles', () => {
  it('should generate correct TypeScript', async () => {
    const outputFilePath = 'hahaha.ts';
    await deleteFile(outputFilePath);
    await generateFromLocalFiles(xataDirectory, outputFilePath);

    expect(readFile(outputFilePath, 'utf-8')).toMatchSnapshot();
  });

  it('should generate correct JavaScript', async () => {
    const outputFilePath = 'hahaha.js';
    await deleteFile(outputFilePath);
    await generateFromLocalFiles(xataDirectory, outputFilePath);

    expect(readFile(outputFilePath, 'utf-8')).toMatchSnapshot();
  });
});

async function deleteFile(path: string) {
  try {
    await unlink(path);
  } catch (err) {
    if ((err as any).code === 'ENOENT') return;
    throw err;
  }
}
