import { faker } from '@faker-js/faker';
import { Flags } from '@oclif/core';
import { getCurrentBranchDetails } from '@xata.io/client';
import { Column } from '@xata.io/codegen';
import { BaseCommand } from '../../base.js';
import fetch from 'node-fetch';

export default class RandomData extends BaseCommand {
  static description = 'Insert random data in the database';

  static examples = [];

  static flags = {
    records: Flags.integer({
      description: 'Number of records to generate per table',
      default: 25
    }),
    table: Flags.string({
      description: 'Table in which to add data (default: all). Can be specified multiple times',
      multiple: true
    })
  };

  static args = [];

  async run(): Promise<void> {
    const { flags } = await this.parse(RandomData);

    const { workspace, database, databaseURL } = await this.getParsedDatabaseURL();
    const xata = await this.getXataClient();
    const branchDetails = await getCurrentBranchDetails({ fetchImpl: fetch, databaseURL });

    if (!branchDetails) {
      this.error('Could not resolve the current branch');
    }
    const branch = branchDetails.branchName;

    for (const table of branchDetails.schema.tables) {
      if (flags.table && !flags.table.includes(table.name)) continue;

      const records: Record<string, unknown>[] = [];
      for (let index = 0; index < flags.records; index++) {
        records.push(this.randomRecord(table.columns));
      }
      await xata.records.bulkInsertTableRecords(workspace, database, branch, table.name, records);

      this.log(`Inserted ${flags.records} random records in table ${table.name}`);
    }
  }

  randomRecord(columns: Column[]) {
    const record: Record<string, unknown> = {};
    for (const column of columns) {
      record[column.name] = this.randomData(column);
    }
    return record;
  }

  randomData(column: Column) {
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
        return this.randomRecord(column.columns || []);
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
