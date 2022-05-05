import { ApiFilter } from './filters';
import { XataRecord } from './record';

type Record = XataRecord & {
  name: string;
  string: string;
  number: number;
  boolean: boolean;
  test: string;
  labels: string[];
  age: number;
  settings: {
    plan: string;
    dark: boolean;
  };
};

// Single column with implicit is
const singleColumnWithImplicitIs: ApiFilter<Record> = { name: 'r2' };

// Single column with explicit is
const singleColumnWithExplicitIs: ApiFilter<Record> = { name: { $is: 'r2' } };

// Is string
const isString: ApiFilter<Record> = { string: 'string' };

// Is true
const isTrue: ApiFilter<Record> = { boolean: true };

// Is false
const isFalse: ApiFilter<Record> = { boolean: false };

// Is pos int
const isPosInt: ApiFilter<Record> = { number: 1234567 };

// Is neg int
const isNegInt: ApiFilter<Record> = { number: -42 };

// Is float
const isFloat: ApiFilter<Record> = { number: 3.14 };

//  with dots
const withDots: ApiFilter<Record> = { 'settings.plan': 'free' };

// Nested columns
const nestedColumns: ApiFilter<Record> = { settings: { plan: 'free' } };

// Nested columns array
const nestedColumnsArray: ApiFilter<Record> = { settings: [{ dark: false }, { plan: 'free' }] };

// Nested columns any
const nestedColumnsAny: ApiFilter<Record> = { settings: { $any: [{ plan: 'free' }, { plan: 'trial' }] } };

// Nested columns any value
const nestedColumnsAnyValue: ApiFilter<Record> = { settings: { plan: { $any: ['free', 'trial'] } } };

// Or with $any
const orWithAny: ApiFilter<Record> = { 'settings.plan': { $any: ['free', 'paid'] } };

// Multiple columns implicit and
const multipleColumnsImplicitAnd: ApiFilter<Record> = { 'settings.dark': true, 'settings.plan': 'free' };

// Explicit $all with multi-key filter list
const explicitAllWithMultiKeyFilterList: ApiFilter<Record> = {
  $all: { 'settings.dark': true, 'settings.plan': 'free' }
};

// Explicit $all with filter list
const explicitAllWithFilterList: ApiFilter<Record> = { $all: [{ 'settings.dark': true }, { 'settings.plan': 'free' }] };

// Explicit $any with multi-key filter list
const explicitAnyWithMultiKeyFilterList: ApiFilter<Record> = {
  $all: { 'settings.dark': true, 'settings.plan': 'free' }
};

// Explicit $any with filter list
const explicitAnyWithFilterList: ApiFilter<Record> = { $any: [{ 'settings.dark': true }, { 'settings.plan': 'free' }] };

// $any with multiple values
const anyWithMultipleValues: ApiFilter<Record> = { number: { $any: [1, 2, 3] } };

// $none with multiple values
const noneWithMultipleValues: ApiFilter<Record> = { number: { $none: [1, 2, 3] } };

// Exists filter
const existsFilter: ApiFilter<Record> = { $exists: 'test' };

// Not exists filter
const notExistsFilter: ApiFilter<Record> = { $notExists: 'test' };

// Exists with all
const existsWithAll: ApiFilter<Record> = { $all: [{ $exists: 'settings' }, { $exists: 'name' }] };

// Nest any with not
const nestAnyWithNot: ApiFilter<Record> = { $not: { $any: { 'settings.dark': true, 'settings.plan': 'free' } } };

// Mix $all and $any with extra keys
const mixAllAndAnyWithExtraKeys: ApiFilter<Record> = {
  $all: { $any: { 'settings.dark': false, 'settings.plan': 'free' }, name: 'r1' }
};

// Range query with less first
const rangeQueryWithLessFirst: ApiFilter<Record> = { age: { $lt: 30, $ge: 20 } };

// Range query with greater first
const rangeQueryWithGreaterFirst: ApiFilter<Record> = { age: { $ge: 20, $lt: 30 } };

// Ordered op
const orderedOp: ApiFilter<Record> = { age: { $lt: 30 } };

// Simple includes
const simpleIncludes: ApiFilter<Record> = { labels: { $includes: 'test' } };

// Simple includes with op
const simpleIncludesWithOp: ApiFilter<Record> = { labels: { $includes: { $contains: 'test' } } };

// Simple includes multiple
const simpleIncludesMultiple: ApiFilter<Record> = { labels: { $includes: ['a', 'b', 'c'] } };

// Simple includes multiple with op
const simpleIncludesMultipleWithOp: ApiFilter<Record> = {
  labels: { $includes: [{ $is: 'a' }, { $is: 'b' }, { $is: 'c' }] }
};

// Includes with many comparisons
const includesWithManyComparisons: ApiFilter<Record> = {
  labels: { $includes: { $all: [{ $contains: 'a' }, { $contains: 'b' }] } }
};

// Simple includes multiple op and value
const simpleIncludesMultipleOpAndValue: ApiFilter<Record> = { labels: { $includes: [{ $contains: 'a' }, 'b'] } };

// Includes with mode and array of filters
const includesWithModeAndArrayOfFilters: ApiFilter<Record> = {
  labels: { $includesNone: [{ $contains: 'test' }, 'abc', { $endsWith: 'bad' }] }
};

// Includes with mix of any and all in predicate position
const includesWithMixOfAnyAndAllInPredicatePosition: ApiFilter<Record> = {
  labels: { $includes: { $any: { $all: [{ $startsWith: 'test' }, { $contains: 'x' }], $any: ['a', 'b'] } } }
};

// Simple $includesany
const simpleIncludesAny: ApiFilter<Record> = { labels: { $includesAny: 'test' } };

// Simple $includesall
const simpleIncludesAll: ApiFilter<Record> = { labels: { $includesAll: 'test' } };

// Simple $includesnone
const simpleIncludesNone: ApiFilter<Record> = { labels: { $includesNone: 'test' } };

// Exists value must be string not int
// @ts-expect-error
const existsValueMustBeStringNotInt: ApiFilter<Record> = { $exists: 42 };

// Exists value must be string not objct
// @ts-expect-error
const existsValueMustBeStringNotObject: ApiFilter<Record> = { $exists: { field: 'settings.unknown' } };

test('fake test', () => {
  // This is a fake test to make sure that the type definitions in this file are working
});
