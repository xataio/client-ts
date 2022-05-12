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
  settings: {
    plan: string;
    dark: boolean;
    labels?: string[];
  };
};

// Simple sorting
const simpleSorting: ApiSortFilter<Record> = { name: 'asc' };

// Array of simple sorting
const arrayOfSimpleSorting: ApiSortFilter<Record> = [{ name: 'asc' }, { age: 'desc' }];

test('fake test', () => {
  // This is a fake test to make sure that the type definitions in this file are working
});
