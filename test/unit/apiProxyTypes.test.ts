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
  test('returns functions for all defined namespace operations', () => {
    for (const namespace of Object.keys(operationsByTag)) {
      const operationsInNamespace = operationsByTag[namespace as keyof typeof operationsByTag];
      for (const operation of Object.keys(operationsInNamespace)) {
        expect(operationsInNamespace[operation as keyof typeof operationsInNamespace]).toBeInstanceOf(Function);
      }
    }
  });
  test('returns undefined for undefined namespaces', () => {
    // @ts-ignore
    expect(xata.undefinedNamespace).toBeUndefined();
  });
  test('returns undefined for undefined namespace operations', () => {
    // @ts-ignore
    expect(xata.authentication.undefinedOperation).toBeUndefined();
  });
});
