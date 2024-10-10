import { describe, expect, test } from 'vitest';
import { XataApiClient } from './client';
import { operationsByTag } from './components';

const xata = new XataApiClient({ apiKey: 'fake-api-key' });

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
    // @ts-expect-error Not a valid namespace
    expect(xata.undefinedNamespace).toBeUndefined();
  });

  test('returns undefined for undefined namespace operations', () => {
    // @ts-expect-error Not a valid operation
    expect(xata.authentication.undefinedOperation).toBeUndefined();
  });
});

describe('XataApiClient', () => {
  test('accepts and uses postgresConnectionString', () => {
    const postgresConnectionString = 'postgres://user:password@localhost:5432/mydb';
    const client = new XataApiClient({ apiKey: 'fake-api-key', postgresConnectionString });

    // @ts-ignore
    expect(client.postgresConnectionString).toBe(postgresConnectionString);
  });
});
