import { fakerEN as faker } from '@faker-js/faker';
import { camelCase, constantCase, kebabCase } from 'change-case';
import pluralize from 'pluralize';

// Faker categories to look up in weighted order
export const fakerCategories = [
  'person',
  'phone',
  'internet',
  'location',
  'date',
  'company',
  'commerce',
  'finance',
  'color',
  'music',
  'airline',
  'animal',
  'git',
  'science',
  'system',
  'vehicle'
] as const;

export type Generator = {
  category: (typeof fakerCategories)[number];
  name: string;
  aliases: string[];
};

export const generators = fakerCategories.reduce((acc, category) => {
  const fakerModule = faker[category];
  const keys = Object.entries(fakerModule)
    .map(([key, value]) => {
      if (typeof value === 'function') return key;
      return '';
    }, [] as string[])
    .filter(Boolean) as string[];

  const fullKeys = keys.map((key) => `${category} ${key}`);
  const aliases = [
    ...keys,
    ...keys.map((key) => pluralize.plural(key)),
    ...fullKeys,
    ...fullKeys.map((key) => camelCase(key)),
    ...fullKeys.map((key) => constantCase(key)),
    ...fullKeys.map((key) => kebabCase(key))
  ];

  return acc.concat(keys.map((name) => ({ category, name, aliases })));
}, [] as Generator[]);

export { faker };
