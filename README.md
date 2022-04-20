# Xata.io SDK for TypeScript and JavaScript

This SDK has zero dependencies, so it can be used in many JavaScript runtimes including Node.js, Cloudflare workers, Deno, Electron, etc.

It also works in browsers for the same reason. But this is strongly discouraged because the API token would be leaked.

## Installing

Install the dependencies

```
npm install @xata.io/client
npm install @xata.io/codegen -D
```

## Usage

There are three ways to use the SDK:

- **API Client**: SDK to interact with the whole Xata API and all its endpoints.
- **Schema-generated Client**: SDK to create/read/update/delete records in a given database following a schema file (with type-safety).
- **Schema-less Client**: SDK to create/read/update/delete records in any database without schema validation (with partial type-safety).

### API Client

One of the main features of the SDK is the ability to interact with the whole Xata API and perform administrative operations such as creating/reading/updating/deleting workspaces, databases, tables, branches...

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

### Schema-generated Client

First of all, add an npm script to your package.json file to invoke `xata-codegen`. You can customize the location of the schema file and the generated output file. For example:

```json
{
  "scripts": {
    "xata-codegen": "xata-codegen generate xata -o generated/client.ts"
  }
}
```

Run it (this is assuming your Xata directory is in `./xata` and it was created by the `xata` cli application)

```bash
npm run xata-codegen
```

In a TypeScript file start using the generated code:

```ts
import { XataClient } from './xata';

const xata = new XataClient({
  branch: 'branchname',
  apiKey: 'xau_1234abcdef',
  fetch: fetchImplementation // Required if your runtime doesn't provide a global `fetch` function.
});
```

The import above will differ if you chose to genreate the types in a different location.

`XataClient` only has two required arguments: `branch` and `apiKey`. `fetch` is required only if your runtime doesn't provide a global `fetch` function. There's also a `databaseURL` argument that by default will contain a URL pointing to your database (e.g. `https://myworkspace-123abc.xata.sh/db/databasename`), it can be specified in the constructor to overwrite that value if for whatever reason you need to connect to a different workspace or database.

The code generator will create two typescript types for each schema entity. The base one will be an `Identifiable` entity with the internal properties you're entity has and the `Record` one will extend it with a set of operations (update, delete, etc...) and some schema metadata (xata version).

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

You will learn more about the available operations below, under the `API Design` section.

### Schema-less Client

If you don't have a schema file, or you are building a generic way to interact with Xata, you can use the `BaseClient` class without schema validation.

```ts
import { BaseClient } from '@xata/client';

const xata = new BaseClient({
  branch: 'branchname',
  apiKey: 'xau_1234abcdef',
  fetch: fetchImplementation // Required if your runtime doesn't provide a global `fetch` function.
});
```

It works the same way as the code-generated `XataClient` but lacks the type-safety of your model.

You can read more on the methods available below, under the `API Design` section.

## API Design

The Xata SDK to create/read/update/delete records follows the repository pattern. Each table will have a repository object available at `xata.db.[table-name]`.

For example if you have a `users` table there'll be a repository at `xata.db.users`. If you're using the schema-less client, you can also use the `xata.db.[table-name]` syntax to access the repository but without typescript auto-completion.

**Creating objects**

Invoke the `create()` method in the repository. Example:

```ts
const user = await xata.db.users.create({
  full_name: 'John Smith'
});
```

If you want to create a record with a specific ID, you can invoke `insert()`.

```ts
const user = await xata.db.users.insert('user_admin', {
  full_name: 'John Smith'
});
```

And if you want to create or insert a record with a specific ID, you can invoke `updateOrInsert()`.

```ts
const user = await client.db.users.updateOrInsert('user_admin', {
  full_name: 'John Smith'
});
```

**Query a single object by its id**

```ts
// `user` will be null if the object cannot be found
const user = await xata.db.users.read('rec_1234abcdef');
```

**Querying multiple objects**

```ts
// Query objects selecting all fields.
const users = await xata.db.users.select().getMany();
const user = await xata.db.users.select().getOne();

// You can also use `xata.db.users` directly, since it's an immutable Query too!
const users = await xata.db.users.getMany();
const user = await xata.db.users.getOne();

// Query objects selecting just one or more fields
const users = await xata.db.users.select('email', 'profile').getMany();

// Apply constraints
const users = await xata.db.users.filter('email', 'foo@example.com').getMany();

// Sorting
const users = await xata.db.users.sort('full_name', 'asc').getMany();
```

Query operations (`select()`, `filter()`, `sort()`) return a `Query` object. These objects are immutable. You can add additional constraints, sort, etc. by calling their methods, and a new query will be returned. In order to finally make a query to the database you'll invoke `getMany()` or `getOne()`. Pagination with limit/offet and cursors will be available in the next release.

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
await admins.getMany(); // still returns all admins

// Finally fetch the results of the query
const users = await query.getMany();
const firstUser = await query.getOne();
```

**Updating objects**

Updating an object leaves the existing instance unchanged, but returns a new object with the updated values.

```ts
// Using an existing object
const updatedUser = await user.update({
  full_name: 'John Smith Jr.'
});

// Using an object's id
const updatedUser = await xata.db.users.update('rec_1234abcdef', {
  full_name: 'John Smith Jr.'
});
```

**Deleting objects**

```ts
// Using an existing object
await user.delete();

// Using an object's id
await xata.db.users.delete('rec_1234abcdef');
```

## Deno support

Right now we are still not publishing the client on deno.land or have support for deno in the codegen.

However you can already use it with your preferred node CDN with the following import in the auto-generated `xata.ts` file:

```ts
import {
  BaseClient,
  Query,
  Repository,
  RestRespositoryFactory,
  XataClientOptions,
  XataRecord
} from 'https://esm.sh/@xata.io/client@<version>/dist/schema?target=deno';
```
