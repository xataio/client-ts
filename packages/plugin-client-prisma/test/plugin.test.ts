import { describe, test } from 'vitest';
import { PrismaXataHTTP } from '../src/driver';
import { smokeTest } from './smoke';
import { BaseClient } from '../../client/src';

describe.skip('@xata.io/prisma plugin', () => {
  test('run smoke tests', async () => {
    const xata = new BaseClient();
    const adapter = new PrismaXataHTTP(xata);

    await smokeTest(adapter);
  });
});
