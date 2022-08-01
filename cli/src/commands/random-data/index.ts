import { faker } from '@faker-js/faker';
import { Flags } from '@oclif/core';
import { Column } from '@xata.io/codegen';
import chalk from 'chalk';
import { BaseCommand } from '../../base.js';
import { pluralize } from '../../utils.js';

export default class RandomData extends BaseCommand {
  static description = 'Insert random data in the database';

  static examples = [];

  static flags = {
    ...this.databaseURLFlag,
    branch: this.branchFlag,
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

    const { workspace, database, branch } = await this.getParsedDatabaseURLWithBranch(flags.db, flags.branch);
    const xata = await this.getXataClient();
    const branchDetails = await xata.branches.getBranchDetails(workspace, database, branch);
    if (!branchDetails) {
      this.error('Could not resolve the current branch');
    }

    const { tables } = branchDetails.schema;
    if (tables.length === 0) {
      this.warn(
        `Your database has no tables. To create one, use ${chalk.bold(
          'xata schema edit'
        )}. Once your database has at least one table, running this command again will generate random data for you.`
      );
      this.log();
    }

    for (const table of tables) {
      if (flags.table && !flags.table.includes(table.name)) continue;

      const records: Record<string, unknown>[] = [];
      for (let index = 0; index < flags.records; index++) {
        records.push(this.randomRecord(table.columns));
      }
      await xata.records.bulkInsertTableRecords(workspace, database, branch, table.name, records);

      this.info(
        `Inserted ${chalk.bold(flags.records)} random ${pluralize('record', flags.records)} in the ${chalk.bold(
          table.name
        )} table`
      );
    }

    this.success(
      `Inserted ${chalk.bold(tables.length * flags.records)} random records across ${chalk.bold(
        tables.length
      )} ${pluralize('table', tables.length)}`
    );
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
