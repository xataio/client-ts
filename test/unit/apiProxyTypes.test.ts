import { beforeAll, describe, expect, test } from 'vitest';
import { XataApiClient } from '../../packages/client/src/api/client';
import { operationsByTag } from '../../packages/client/src/api/components';

let xata: XataApiClient;

beforeAll(async () => {
  xata = new XataApiClient({
    apiKey: 'fake-api-key'
  });
});

describe('API Proxy types', () => {
  test('returns functions for all defined operation methods', async () => {
    for (const operation of Object.keys(operationsByTag)) {
      const operationInNamespace = operationsByTag[operation as keyof typeof operationsByTag];
      for (const method of Object.keys(operationInNamespace)) {
        expect(operationInNamespace[method as keyof typeof operationInNamespace]).toBeInstanceOf(Function);
      }
    }
  });
  test('returns undefined for undefined operations', async () => {
    // @ts-ignore
    expect(xata.undefinedOperation).toBeUndefined();
  });
  test('returns undefined for undefined operation methods', async () => {
    // @ts-ignore
    expect(xata.authentication.undefinedOperation).toBeUndefined();
  });
});
