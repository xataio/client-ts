/* eslint-disable @typescript-eslint/no-unused-vars */
import { test } from 'vitest';
import { XataRecord } from '../schema';
import { Boosters } from './boosters';

type Record = {
  name: string;
  description?: string | null;
  upvotes?: number;
  number?: number;
  obj?: {
    score: number;
  } | null;
  createdAt?: Date | null;
} & XataRecord;

const validBoosters1: Boosters<Record>[] = [{ numericBooster: { column: 'upvotes', factor: 10 } }];

const validBoosters2: Boosters<Record>[] = [{ numericBooster: { column: 'obj.score', factor: 10 } }];

const validBoosters3: Boosters<Record>[] = [{ numericBooster: { column: 'obj.score', factor: 10 } }];

const validBoosters4: Boosters<Record>[] = [
  { dateBooster: { column: 'createdAt', origin: '2020-01-21T00:00:00Z', scale: '1d', decay: 0.2 } }
];

const validBoosters5: Boosters<Record>[] = [
  { valueBooster: { column: 'upvotes', value: 10, factor: 100 } },
  { numericBooster: { column: 'upvotes', factor: 10 } }
];

const validBoosters6: Boosters<Record>[] = [
  { valueBooster: { column: 'name', value: 'r4', factor: 100 } },
  { valueBooster: { column: 'name', value: 'r3', factor: 75 } }
];

const validBoosters7: Boosters<Record>[] = [
  { valueBooster: { column: 'name', value: 'r4', factor: 100 } },
  // @ts-expect-error
  { valueBooster: { column: 'upvotes', value: 10, factor: 75 }, numericBooster: { column: 'upvotes', factor: 100 } }
];

const validBoosters8: Boosters<Record>[] = [
  { numericBooster: { column: 'upvotes', factor: 10, modifier: 'reciprocal' } },
  {
    numericBooster: { column: 'upvotes', factor: 10, ifMatchesFilter: { 'obj.score': { $lt: 2.1 } } }
  },
  {
    numericBooster: { column: 'upvotes', factor: 10, ifMatchesFilter: { upvotes: { $lt: 4 } } }
  }
];

const invalidBoosters1: Boosters<Record>[] = [
  // @ts-expect-error
  { numericBooster: { column: 'name', factor: 50, modifier: 'invalid' } },
  {
    // @ts-expect-error
    dateBooster: { column: 'invalid', origin: '2020-01-21T00:00:00Z', scale: '1d', decay: 0.2 },
    ifMatchesFilter: { noSuchColumn: 'test' }
  }
];

test('fake test', () => {
  // This is a fake test to make sure that the type definitions in this file are working
});
