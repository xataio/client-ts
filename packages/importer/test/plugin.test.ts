import { buildClient } from '@xata.io/client';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { join } from 'path';
import { expect, test } from 'vitest';
import { XataImportPlugin } from '../src/plugin';

// Get environment variables before reading them
dotenv.config({ path: join(process.cwd(), '.env') });

const XataClient = buildClient({
  import: new XataImportPlugin()
});

const xata = new XataClient({ fetch });

test('plugin mode', () => {
  expect(xata.import).toBeDefined();
  expect(xata.import.read).toBeDefined();
  expect(xata.import.read.file).toBeInstanceOf(Function);
});
