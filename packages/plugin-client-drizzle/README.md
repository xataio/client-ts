# @xata.io/drizzle

A [Drizzle](https://github.com/drizzle-team/drizzle-orm) driver for [Xata](https://xata.io), using the [Xata serverless driver for TypeScript](https://github.com/xataio/client-ts).

The goal of this package is polish the implementation and contribute it back to the official Drizzle repository.

## Installation

You should install both `drizzle-orm` and `@xata.io/drizzle` with `@xata.io/client`. You can install them with your favorite package manager:

```bash
# with pnpm
pnpm add drizzle-orm @xata.io/drizzle @xata.io/client

# with yarn
yarn add drizzle-orm @xata.io/drizzle @xata.io/client

# with npm
npm install drizzle-orm @xata.io/drizzle @xata.io/client
```

## Usage

To work with drizzle you need to define your models and then create a drizzle instance with the models.

```ts
import { pgTable, text } from 'drizzle-orm/pg-core';
import { drizzle } from '@xata.io/drizzle';
import { getXataClient } from './xata';

const xata = getXataClient();
const db = drizzle(xata);

const drivers = pgTable('drivers', {
  id: text('id').primaryKey(),
  surname: text('surname'),
  forename: text('forename')
});

const result = await db.select().from(drivers).execute();
```

## [Experimental] Model generation

We offer an experimental model generation helper that will generate the models for you from your `tables` array in your `xata.ts` file. Since it's a work in progress, we don't recommend using it in production yet, please build your models manually.

```ts
import { buildModels } from '@xata.io/drizzle';
import { tables } from './xata';

const { drivers } = buildModels(tables);

const result = await db.select().from(drivers).execute();
```

## Limitations

- Migrations from drizzle are not supported yet, we will add them once the SQL endpoint allows it.
- Transactions are not supported yet, we will add them once the SQL endpoint allows it.
