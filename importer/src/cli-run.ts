import ora from 'ora';
import { ParseOptions } from './index.js';
import { parseFile, parseStream } from './csv.js';
import { readFile } from 'fs/promises';
import path from 'path';
import { homedir } from 'os';
import { transliterate } from 'transliteration';
import camelcase from 'camelcase';

const spinner = ora();

export async function run(file: string, { table, columns, types, noheader, format }: Record<string, unknown>) {
  // const key = await readKey()

  if (format !== 'csv') {
    return exitWithError('The only supported format right now is csv');
  }

  const options: ParseOptions = {
    columns: split(columns),
    noheader: Boolean(noheader),
    callback: async (lines, columns) => {
      console.log('lines:', lines, columns);
    }
  };

  console.log({ file, table, columns, types, noheader });

  try {
    if (file === '-') {
      await parseStream(process.stdin, options);
    } else {
      await parseFile(file, options);
    }
  } catch (err) {
    exitWithError(err);
  }
}

function split(value: unknown): string[] | undefined {
  if (!value) return;
  return String(value)
    .split(',')
    .map((s) => s.trim());
}

function normalizeColumnName(value: string) {
  const parts = value.split('.');
  return parts.map((s) => camelcase(transliterate(s)).replace(/\W/g, '')).join('.');
}

async function readKey() {
  // TODO: is this the same for windows?
  const keyPath = path.join(homedir(), '.config', 'xata', 'key');
  try {
    return await readFile(keyPath, 'utf-8');
  } catch (err) {
    exitWithError(
      `Could not read API Key at ${keyPath}. Please install the Xata CLI and run xata login. More information at https://github.com/xataio/cli`
    );
    throw err;
  }
}

function exitWithError(err: unknown) {
  spinner.fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

console.log(normalizeColumnName('你好. world!'));
