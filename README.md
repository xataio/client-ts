# Xata.io SDK for TypeScript and JavaScript

This SDK has zero dependencies, so it can be used in many JavaScript runtimes including Node.js, Cloudflare workers, Deno, Electron, etc.

It also works in browsers for the same reason. But this is strongly discouraged because the API token would be leaked.

## Installing

Install the dependencies:

```
npm install @xata.io/client
npm install @xata.io/codegen -D
```

## Code generation

Add an npm script to your package.json file to invoke `xata-codegen`. You can customize the location of the schema file and the generated output file. For example:

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

const client = new XataClient({
  databaseURL: 'https://myworkspace-123abc.xata.sh/db/databasename',
  branch: 'branchname',
  apiKey: 'xau_1234abcdef',
  fetch: fetchImplememntation // Required if your runtime doesn't provide a global `fetch` function.
});
```

The import above will differ if you chose to genreate the types in a different location.

`fetch` is required only if your runtime doesn't provide a global `fetch` function. However, if your runtime supports CJS, the SDK will try to also require `node-fetch` and `cross-fetch` if a `fetch` implementation is not provided.

## API

The Xata SDK follows the repository pattern. Each table will have a repository object available at `xata.db.[table-name]`. For example if you have a `users` table there'll be a repository at `xata.db.users`.

**Creating objects**

Invoke the `create()` method in the repository. Example:

```ts
const user = await xata.db.users.create({
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


