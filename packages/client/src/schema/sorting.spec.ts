/* eslint-disable @typescript-eslint/no-unused-vars */
import { test } from 'vitest';
import { XataRecord } from './record';
import { ApiSortFilter } from './sorting';

type Record = XataRecord & {
  name: string;
  string: string;
  number: number;
  boolean: boolean;
  test: string;
  labels?: string[];
  age: number;
};

// Simple sorting
const simpleSorting: ApiSortFilter<Record> = { name: 'asc' };

// Array of simple sorting
const arrayOfSimpleSorting: ApiSortFilter<Record> = [{ name: 'asc' }, { age: 'desc' }];

// Sort with wildcard is not allowed
//@ts-expect-error
const sortWithWildcard: ApiSortFilter<Record> = { '*': 'asc' };

// Sort with random wildcard is allowed
const sortWithRandomWildcard: ApiSortFilter<Record> = { '*': 'random' };

// Sort with random wildcard on a given column is not allowed
//@ts-expect-error
const sortWithRandomWildcardOnColumn: ApiSortFilter<Record> = { name: 'random' };

// Sort by updatedAt is allowed
const sortWithUpdatedAt: ApiSortFilter<Record> = { 'xata.updatedAt': 'asc' };

// Sort by createdAt is allowed
const sortWithCreatedAt: ApiSortFilter<Record> = { 'xata.createdAt': 'asc' };

// Sort by unknown metadata is not allowed
//@ts-expect-error
const sortWithUnknownMetadata: ApiSortFilter<Record> = { 'xata.unknown': 'asc' };

test('fake test', () => {
  // This is a fake test to make sure that the type definitions in this file are working
});
