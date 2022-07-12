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

const validBoosters: Boosters<Record>[] = [
  { numericBooster: { column: 'upvotes', factor: 10 } },
  { numericBooster: { column: 'obj.score', factor: 10 } },
  { dateBooster: { column: 'createdAt', origin: '2020-01-21T00:00:00Z', scale: '1d', decay: 0.2 } },
  { valueBooster: { column: 'name', value: 'r4', factor: 100 } },
  { valueBooster: { column: 'name', value: 'r3', factor: 75 } },
  { valueBooster: { column: 'upvotes', value: 10, factor: 100 } },
  { valueBooster: { column: 'upvotes', value: 20, factor: 75 }, numericBooster: { column: 'upvotes', factor: 10 } }
];

test('fake test', () => {
  // This is a fake test to make sure that the type definitions in this file are working
});
