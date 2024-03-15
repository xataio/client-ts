import { fakerEN as faker } from '@faker-js/faker';
import { Schemas } from '@xata.io/client';
import { z } from 'zod';

export function generateRandomData(table: Schemas.Table, size: number, pgRollEnabled?: boolean) {
  const records: Record<string, unknown>[] = [];

  for (let index = 0; index < size; index++) {
    records.push(randomRecord(table.columns, pgRollEnabled));
  }

  return records;
}

function randomRecord(columns: Schemas.Column[], pgRollEnabled?: boolean) {
  const record: Record<string, unknown> = {};
  for (const column of columns) {
    // TODO column should contain pgType field from schema
    record[column.name] = pgRollEnabled ? randomDataPgroll(column as any) : randomData(column);
  }
  return record;
}

function randomData(column: Schemas.Column) {
  switch (column.type) {
    case 'text':
      return faker.lorem.paragraphs(rand(2, 3));
    case 'email':
      return faker.internet.email({ provider: 'acme.pets' });
    case 'int':
      return rand(1, 100);
    case 'float':
      return rand(1, 10000) / rand(1, 100);
    case 'bool':
      return rand(0, 1) === 1;
    case 'multiple':
      return faker.word.words(rand(1, 3)).split(' ');
    case 'string':
      return randomString(column.name);
    case 'datetime':
      return faker.date.recent({ days: rand(1, 10) });
    default:
      return undefined;
  }
}

function randomDataPgroll(column: Schemas.Column & { comment?: string; pgType: string }) {
  const columnCommentType = narrowStringType(column.comment);
  // Note that this is a best effort and seeding may fail for invalid Xata columns
  // that are foreign keys, or have constraints such as length attached to them.
  switch (column.pgType) {
    case 'boolean':
    case 'bool':
      return rand(0, 1) === 1;
    case 'bigint':
    case 'int8':
    case 'integer':
    case 'int':
    case 'int4':
    case 'smallint':
      return rand(1, 100);
    case 'double precision':
    case 'float8':
    case 'real':
      return rand(1, 10000) / rand(1, 100);
    case 'text':
    case 'varchar':
    case 'character varying':
      if (columnCommentType === 'email') return faker.internet.email({ provider: 'acme.pets' });
      if (column.type === 'link') return undefined;
      return faker.word.words(1);
    case 'timestamptz':
      return faker.date.recent({ days: rand(1, 10) });
    case 'text[]':
      return faker.word.words(rand(1, 3)).split(' ');
  }
  if (column.pgType.startsWith('character(') || column.pgType.startsWith('varchar(')) return faker.word.words(1);
  if (column.pgType.startsWith('numeric(')) return rand(1, 10000) / rand(1, 100);

  return undefined;
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min) + min);
}

const generators: Record<string, () => string> = {
  city: () => faker.location.city(),
  country: () => faker.location.country(),
  county: () => faker.location.county(),
  state: () => faker.location.state(),
  street: () => faker.location.street(),
  timezone: () => faker.location.timeZone(),
  tz: () => faker.location.timeZone(),
  zipcode: () => faker.location.zipCode(),
  zip: () => faker.location.zipCode(),
  department: () => faker.commerce.department(),
  product: () => faker.commerce.product(),
  company: () => faker.company.name(),
  firstName: () => faker.person.firstName(),
  lastName: () => faker.person.lastName(),
  phone: () => faker.phone.number('501-###-###')
};

function randomString(columnName: string) {
  const gen = generators[columnName.toLowerCase()];
  if (gen) return gen();
  return faker.word.words(2);
}

export const xataStringColumns = ['email', 'text', 'string'] as const;

const XataStringColumn = z.object({
  ['xata.type']: z.enum(xataStringColumns)
});

const narrowStringType = (comment?: string): Schemas.Column['type'] => {
  if (!comment) return 'text';
  const result = XataStringColumn.safeParse(JSON.parse(comment));
  return result.success ? result.data['xata.type'] : 'text';
};
