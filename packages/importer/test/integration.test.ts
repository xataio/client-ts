import { Importer } from '../src/importer';
import { expect, test } from 'vitest';
import { readFile } from 'fs/promises';

const __dirname = new URL('.', import.meta.url).pathname;

const importer = new Importer();

type Test = {
  file: string;
  strategy: string;
  encoding?: string;
};

const tests: Test[] = [
  { file: 'sample-1.csv', strategy: 'csv' },
  { file: 'sample-2.csv', strategy: 'csv' },
  { file: 'sample-3.csv', strategy: 'csv' },
  { file: 'sample-4.tsv', strategy: 'csv' },
  { file: 'sample-5.csv', strategy: 'csv' }
];

for (const { encoding, file, strategy } of tests) {
  const decoder = new TextDecoder(encoding ?? 'utf-8');
  const contents = await readFile(`${__dirname}/fixtures/${file}`);
  const data = decoder.decode(contents);

  test(`Test - ${file}`, async () => {
    const result = await importer.read({ strategy: strategy as any, data, tableName: 'foo' });

    expect(result).toMatchSnapshot();
  });
}
