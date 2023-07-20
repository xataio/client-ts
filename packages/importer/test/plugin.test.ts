import { describe, expect, test } from 'vitest';
import { getXataClientWithPlugin } from './utils';

const xata = getXataClientWithPlugin();

describe('@xata.io/importer plugin', () => {
  test('plugin has correct functions', () => {
    expect(xata.import).toBeDefined();
    expect(xata.import.parseCsvStream).toBeInstanceOf(Function);
    expect(xata.import.parseCsvStreamBatches).toBeInstanceOf(Function);
    expect(xata.import.importBatch).toBeInstanceOf(Function);
  });
});
