# Xata SDK for TypeScript and JavaScript

This SDK has zero dependencies, so it can be used in many JavaScript runtimes including Node.js, Cloudflare workers, Deno, Electron, etc. It also works in browsers for the same reason. But this is strongly discouraged because you can easily leak your API keys from browsers.

## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Installation](#installation)
- [Usage](#usage)
  - [Schema-generated Client](#schema-generated-client)
  - [Schema-less Client](#schema-less-client)
  - [API Design](#api-design)
    - [Creating Objects](#creating-objects)
    - [Query a Single Object by its ID](#query-a-single-object-by-its-id)
    - [Querying Multiple Objects](#querying-multiple-objects)
    - [Updating Objects](#updating-objects)
    - [Deleting Objects](#deleting-objects)
  - [API Client](#api-client)
- [Deno support](#deno-support)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation

```bash
npm install @xata.io/client
```

## Usage

There are three ways to use the SDK:

- **Schema-generated Client**: SDK to create/read/update/delete records in a given database following a schema file (with type-safety).
- **Schema-less Client**: SDK to create/read/update/delete records in any database without schema validation (with partial type-safety).
- **API Client**: SDK to interact with the whole Xata API and all its endpoints.

### Schema-generated Client

To use the schema-generated client, you need to run the code generator utility that comes with [our CLI](https://docs.xata.io/cli/getting-started).

To run it (and assuming you have configured the project with `xata init`):

```bash
xata codegen
```

In a TypeScript file, start using the generated code like this:

```ts
import { XataClient } from './xata'; // or wherever you chose to generate the client

const xata = new XataClient();
```

The import above will differ if you chose to generate the code in a different location.

The `XataClient` constructor accepts an object with configuration options, like the `fetch` parameter, which is required only if your runtime doesn't provide a global `fetch` function. There's also a `databaseURL` argument that by default will contain a URL pointing to your database (e.g. `https://myworkspace-123abc.xata.sh/db/databasename`). It can be specified in the constructor to overwrite that value if for whatever reason you need to connect to a different workspace or database.

The code generator will create two TypeScript types for each schema entity. The base one will be an `Identifiable` entity with the internal properties your entity has and the `Record` one will extend it with a set of operations (update, delete, etc...) and some schema metadata (xata version).

```ts
interface User extends Identifiable {
  email?: string | null;
}

type UserRecord = User & XataRecord;

async function initializeDatabase(admin: User): Promise<UserRecord> {
  return xata.db.users.create(admin);
}

const admin = await initializeDatabase({ email: 'admin@example.com' });
await admin.update({ email: 'admin@foo.bar' });
await admin.delete();
```

You will learn more about the available operations below, under the [`API Design`](#api-design) section.

### Schema-less Client

If you don't have a schema file, or you are building a generic way to interact with Xata, you can use the `BaseClient` class without schema validation.

```ts
import { BaseClient } from '@xata.io/client';

const xata = new BaseClient({
  branch: 'branchname',
  apiKey: 'xau_1234abcdef',
  fetch: fetchImplementation // Required if your runtime doesn't provide a global `fetch` function.
});
```

It works the same way as the code-generated `XataClient` but doesn't provide type-safety for your model.

You can read more on the methods available below, in the next section.

### API Design

The Xata SDK to create/read/update/delete records follows the [repository pattern](https://lyz-code.github.io/blue-book/architecture/repository_pattern/). Each table will have a repository object available at `xata.db.[table-name]`.

For example if you have a `users` table, there'll be a repository at `xata.db.users`. If you're using the schema-less client, you can also use the `xata.db.[table-name]` syntax to access the repository but without TypeScript auto-completion.

#### Creating Objects

Invoke the `create()` method in the repository. Example:

```ts
const user = await xata.db.users.create({
  fullName: 'John Smith'
});
```

If you want to create a record with a specific ID, you can invoke `insert()`.

```ts
const user = await xata.db.users.insert('user_admin', {
  fullName: 'John Smith'
});
```

And if you want to create or insert a record with a specific ID, you can invoke `updateOrInsert()`.

```ts
const user = await client.db.users.updateOrInsert('user_admin', {
  fullName: 'John Smith'
});
```

#### Query a Single Object by its ID

```ts
// `user` will be null if the object cannot be found
const user = await xata.db.users.read('rec_1234abcdef');
```

#### Querying Multiple Objects

```ts
// Query objects selecting all fields.
const page = await xata.db.users.select().getPaginated();
const user = await xata.db.users.select().getFirst();

// You can also use `xata.db.users` directly, since it's an immutable Query too!
const page = await xata.db.users.getPaginated();
const user = await xata.db.users.getFirst();

// Query objects selecting just one or more fields
const page = await xata.db.users.select('email', 'profile').getPaginated();

// Apply constraints
const page = await xata.db.users.filter('email', 'foo@example.com').getPaginated();

// Sorting
const page = await xata.db.users.sort('full_name', 'asc').getPaginated();
```

Query operations (`select()`, `filter()`, `sort()`) return a `Query` object. These objects are immutable. You can add additional constraints, `sort`, etc. by calling their methods, and a new query will be returned. In order to finally make a query to the database you'll invoke `getPaginated()`, `getMany()`, `getAll()`, or `getFirst()`.

```ts
// Operators that combine multiple conditions can be deconstructed
const { filter, any, all, not, sort } = xata.db.users;
const query = filter('email', 'foo@example.com');

// Single-column operators are imported directly from the package
import { gt, includes, startsWith } from '@xata.io/client';
filter('email', startsWith('username')).not(filter('created_at', gt(somePastDate)));

// Queries are immutable objects. This is useful to derive queries from other queries
const admins = filter('admin', true);
const spaniardsAdmins = admins.filter('country', 'Spain');
await admins.getAll(); // still returns all admins

// Finally fetch the results of the query
const users = await query.getAll();
const firstUser = await query.getFirst();
```

The `getPaginated()` method will return a `Page` object. It's a wrapper that internally uses cursor based pagination.

```ts
page.records; // Array of records
page.hasNextPage(); // Boolean

const nextPage = await page.nextPage(); // Page object
const previousPage = await page.previousPage(); // Page object
const firstPage = await page.firstPage(); // Page object
const lastPage = await page.lastPage(); // Page object
```

If you want to use an iterator, both the Repository and the Query classes implement an `AsyncIterable`. Alternatively you can use `getIterator()` and customize the batch size of the iterator:

```ts
for await (const record of xata.db.users) {
  console.log(record);
}

for await (const record of xata.db.users.filter('team.id', teamId)) {
  console.log(record);
}

for await (const records of xata.db.users.getIterator({ batchSize: 100 })) {
  console.log(records);
}
```

#### Updating Objects

Updating an object leaves the existing instance unchanged, but returns a new object with the updated values.

```ts
// Using an existing object
const updatedUser = await user.update({
  fullName: 'John Smith Jr.'
});

// Using an object's id
const updatedUser = await xata.db.users.update('rec_1234abcdef', {
  fullName: 'John Smith Jr.'
});
```

#### Deleting Objects

```ts
// Using an existing object
await user.delete();

// Using an object's id
await xata.db.users.delete('rec_1234abcdef');
```

### API Client

One of the main features of the SDK is the ability to interact with the whole Xata API and perform administrative operations such as creating/reading/updating/deleting [workspaces](https://docs.xata.io/concepts/workspaces), databases, tables, branches...

To communicate with the SDK we provide a constructor called `XataApiClient` that accepts an API token and an optional fetch implementation method.

```ts
const api = new XataApiClient({ apiKey: process.env.XATA_API_KEY });
```

Once you have initialized the API client, the operations are organized following the same hiearchy as in the [official documentation](https://docs.xata.io). You have different namespaces for each entity (ie. `workspaces`, `databases`, `tables`, `branches`, `users`, `records`...).

```ts
const { id: workspace } = await client.workspaces.createWorkspace({ name: 'example', slug: 'example' });
const { databaseName } = await client.databases.createDatabase(workspace, 'database');

await client.branches.createBranch(workspace, databaseName, 'branch');
await client.tables.createTable(workspace, databaseName, 'branch', 'table');
await client.tables.setTableSchema(workspace, databaseName, 'branch', 'table', {
  columns: [{ name: 'email', type: 'string' }]
});

const { id: recordId } = await client.records.insertRecord(workspace, databaseName, 'branch', 'table', {
  email: 'example@foo.bar'
});

const record = await client.records.getRecord(workspace, databaseName, 'branch', 'table', recordId);

await client.workspaces.deleteWorkspace(workspace);
```

## Deno support

We publish the client on [deno.land](https://deno.land/x/xata). You can use it by changing the import in the auto-generated `xata.ts` file:

```ts
import { buildClient, BaseClientOptions, XataRecord } from 'https://deno.land/x/xata/mod.ts';
```
