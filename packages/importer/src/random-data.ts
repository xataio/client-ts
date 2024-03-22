import { fakerEN as faker } from '@faker-js/faker';
import { Schemas } from '@xata.io/client';
import { z } from 'zod';

// TODO: Remove this once we migrate pgroll branches
type PgRollColumn = Schemas.Column & {
  comment?: string;
  pgType?: string;
};

export function generateRandomData(table: Schemas.Table, size: number) {
  const records: Record<string, unknown>[] = [];

  for (let index = 0; index < size; index++) {
    records.push(randomRecord(table.columns));
  }

  return records;
}

function randomRecord(columns: PgRollColumn[]) {
  const record: Record<string, unknown> = {};
  for (const column of columns) {
    record[column.name] = randomData(column);
  }
  return record;
}

function randomData(column: PgRollColumn) {
  const columnCommentType = narrowStringType(column.comment);
  // Note that this is a best effort and seeding may fail for invalid Xata columns
  // that are foreign keys, or have constraints such as length attached to them.
  switch (column.pgType) {
    case 'boolean':
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
      return faker.word.words(3);
    case 'timestamptz':
      return faker.date.recent({ days: rand(1, 10) });
    case 'text[]':
      return faker.word.words(rand(1, 3)).split(' ');
  }

  if (column.pgType?.startsWith('character(') || column.pgType?.startsWith('varchar(')) return faker.word.words(3);
  if (column.pgType?.startsWith('numeric(')) return rand(1, 10000) / rand(1, 100);

  return undefined;
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min) + min);
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
