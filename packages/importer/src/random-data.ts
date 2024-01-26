import { fakerEN as faker } from '@faker-js/faker';
import { Schemas } from '@xata.io/client';

export function generateRandomData(table: Schemas.Table, size: number) {
  const records: Record<string, unknown>[] = [];

  for (let index = 0; index < size; index++) {
    records.push(randomRecord(table.columns));
  }

  return records;
}

function randomRecord(columns: Schemas.Column[]) {
  const record: Record<string, unknown> = {};
  for (const column of columns) {
    record[column.name] = randomData(column);
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
