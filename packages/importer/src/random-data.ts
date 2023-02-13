import { faker } from '@faker-js/faker';
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
      return faker.internet.email(undefined, undefined, 'acme.pets');
    case 'int':
      return rand(1, 100);
    case 'float':
      return rand(1, 10000) / rand(1, 100);
    case 'bool':
      return rand(0, 1) === 1;
    case 'object':
      return randomRecord(column.columns || []);
    case 'multiple':
      return faker.random.words(rand(1, 3)).split(' ');
    case 'string':
      return randomString(column.name);
    case 'datetime':
      return faker.date.recent(rand(1, 10));
    default:
      return undefined;
  }
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min) + min);
}

const generators: Record<string, () => string> = {
  city: () => faker.address.city(),
  country: () => faker.address.country(),
  county: () => faker.address.county(),
  state: () => faker.address.state(),
  street: () => faker.address.street(),
  timezone: () => faker.address.timeZone(),
  tz: () => faker.address.timeZone(),
  zipcode: () => faker.address.zipCode(),
  zip: () => faker.address.zipCode(),
  department: () => faker.commerce.department(),
  product: () => faker.commerce.product(),
  company: () => faker.company.companyName(),
  firstName: () => faker.name.firstName(),
  lastName: () => faker.name.lastName(),
  phone: () => faker.phone.phoneNumber('501-###-###')
};

function randomString(columnName: string) {
  const gen = generators[columnName.toLowerCase()];
  if (gen) return gen();
  return faker.random.words(2);
}
