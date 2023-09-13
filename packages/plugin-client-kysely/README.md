# @xata.io/kysely

A [Kysely](https://github.com/kysely-org/kysely) dialect for [Xata](https://xata.io), using the [Xata serverless driver for TypeScript](https://github.com/xataio/client-ts).

## Installation

You should install both `kysely` and `@xata.io/kysely` with `@xata.io/client`. You can install them with your favorite package manager:

```bash
# with bun
bun install kysely @xata.io/kysely @xata.io/client

# with pnpm
pnpm add kysely @xata.io/kysely @xata.io/client

# with yarn
yarn add kysely @xata.io/kysely @xata.io/client

# with npm
npm install kysely @xata.io/kysely @xata.io/client
```

## Usage

You can pass a new instance of `XataDialect` as the `dialect` option when creating a new `Kysely` instance:

```typescript
import { Kysely } from 'kysely';
import { XataDialect, Model } from '@xata.io/kysely';
import { DatabaseSchema, getXataClient } from './xata.ts';

const xata = getXataClient();

const db = new Kysely<Model<DatabaseSchema>>({
  dialect: new XataDialect({ xata })
});

const drivers = await db.selectFrom('users').select(['name', 'email']).execute();
```

`XataDialect` accepts your Xata client instance as its only option. You can find more information about creating a Xata client instance in our [getting started guide](https://xata.io/docs/getting-started/installation).
