import {
  boolean,
  char,
  cidr,
  inet,
  integer,
  jsonb,
  macaddr,
  macaddr8,
  pgTable,
  serial,
  text,
  timestamp
} from 'drizzle-orm/pg-core';

export const usersTable = pgTable('users', {
  id: serial('id' as string).primaryKey(),
  name: text('name').notNull(),
  verified: boolean('verified').notNull().default(false),
  jsonb: jsonb('jsonb').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const citiesTable = pgTable('cities', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  state: char('state', { length: 2 })
});

export const cities2Table = pgTable('cities', {
  id: serial('id').primaryKey(),
  name: text('name').notNull()
});

export const users2Table = pgTable('users2', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  cityId: integer('city_id').references(() => citiesTable.id)
});

export const coursesTable = pgTable('courses', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  categoryId: integer('category_id').references(() => courseCategoriesTable.id)
});

export const courseCategoriesTable = pgTable('course_categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull()
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  region: text('region').notNull(),
  product: text('product')
    .notNull()
    .$default(() => 'random_string'),
  amount: integer('amount').notNull(),
  quantity: integer('quantity').notNull()
});

export const network = pgTable('network_table', {
  inet: inet('inet').notNull(),
  cidr: cidr('cidr').notNull(),
  macaddr: macaddr('macaddr').notNull(),
  macaddr8: macaddr8('macaddr8').notNull()
});

export const salEmp = pgTable('sal_emp', {
  name: text('name'),
  payByQuarter: integer('pay_by_quarter').array(),
  schedule: text('schedule').array().array()
});

export const _tictactoe = pgTable('tictactoe', {
  squares: integer('squares').array(3).array(3)
});

export const usersMigratorTable = pgTable('users12', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull()
});

// To test aggregate functions
export const aggregateTable = pgTable('aggregate_table', {
  id: serial('id').notNull(),
  name: text('name').notNull(),
  a: integer('a'),
  b: integer('b'),
  c: integer('c'),
  nullOnly: integer('null_only')
});
