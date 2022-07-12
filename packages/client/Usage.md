# TypeScript SDK

There're four types of objects in the Xata TypeScript SDK:

- `Repository`: a table representation that can be used to create, read, update, and delete records.
- `Query`: a combination of filters and other parameters to retrieve a collection of records.
- `XataRecord`: a row in a table.
- `Page`: a collection of records that can be paginated.

## Repository

Any table in the database can be represented by a `Repository` object.

A repository is an object that can be used to create, read, update, and delete records in the table it represents.

It also implements the `Query` and `Page` interfaces, so you can use it to query and paginate the records in the table too. We'll see how to use these objects in the next section.

### Reading records

The `read()` method can be used to read a records by their ids:

- If the object cannot be found, the method will return `null`.
- If the object can be found, the method will return a `XataRecord` object.

You can read a single record by its id.

```ts
const user = await xata.db.users.read('rec_1234abcdef');
```

You can also read multiple records by their ids.

```ts
const users = await xata.db.users.read(['rec_1234abcdef', 'rec_5678defgh']);
```

And you can read records coming from an object that contains an `id` property.

```ts
const object1 = { id: 'rec_1234abcdef' };
const object2 = { id: 'rec_5678defgh' };

const user = await xata.db.users.read(object1);
const users = await xata.db.users.read([object1, object2]);
```

### Creating records

Both the `create()` and `createOrUpdate()` methods can be used to create a new record.

- The `create()` method will create a new record and fail if the provided id already exists.
- The `createOrUpdate()` method will create a new record if the provided id doesn't exist, or update an existing record if it does.

You can create a record without providing an id, and the id will be generated automatically.

```ts
const user = await xata.db.users.create({ fullName: 'John Smith' });
user.id; // 'rec_1234abcdef'
```

You can create a record with an id as parameter, and the id will be used.

```ts
const user = await xata.db.users.create('user_admin', { fullName: 'John Smith' });
user.id; // 'user_admin'
```

You can create a record with the id provided in the object, and the id will be used.

```ts
const user = await xata.db.users.create({ id: 'user_admin', fullName: 'John Smith' });
user.id; // 'user_admin'
```

You can create multiple records at once by providing an array of objects.

```ts
const users = await xata.db.users.create([{ fullName: 'John Smith' }, { id: 'user_admin', fullName: 'Jane Doe' }]);
users[0].id; // 'rec_1234abcdef'
users[1].id; // 'user_admin'
```

For the `createOrUpdate()` method, it beaves the same way as `create()` but you will always need to provide an id.

```ts
const user1 = await xata.db.users.createOrUpdate('user_admin', { fullName: 'John Smith' });
const user2 = await xata.db.users.createOrUpdate({ id: 'user_manager', fullName: 'Jane Doe' });
const users = await xata.db.users.createOrUpdate([
  { id: 'user_admin', fullName: 'John Smith' },
  { id: 'user_manager', fullName: 'Jane Doe' }
]);
```

### Updating records

The `update()` method can be used to update an existing record. It will throw an Error if the record cannot be found.

```ts
const user = await xata.db.users.update('rec_1234abcdef', { fullName: 'John Smith' });
```

The `id` property can also be sent in the object update.

```ts
const user = await xata.db.users.update({ id: 'user_admin', fullName: 'John Smith' });
```

You can update multiple records at once by providing an array of objects.

```ts
const users = await xata.db.users.update([
  { id: 'rec_1234abcdef', fullName: 'John Smith' },
  { id: 'user_admin', fullName: 'Jane Doe' }
]);
```

### Deleting records

The `delete()` method can be used to delete an existing record. It will throw an Error if the record cannot be found.

```ts
const user = await xata.db.users.delete('rec_1234abcdef');
```

You can delete multiple records at once by providing an array of ids.

```ts
const users = await xata.db.users.delete(['rec_1234abcdef', 'user_admin']);
```

You can delete records coming from an object that contains an `id` property.

```ts
const object1 = { id: 'rec_1234abcdef' };

const user = await xata.db.users.delete(object1);
```

You can delete records coming from an array of objects that contain an `id` property.

```ts
const object1 = { id: 'rec_1234abcdef' };
const object2 = { id: 'user_admin' };

const users = await xata.db.users.delete([object1, object2]);
```

### Searching records

The `search()` method can be used to search records. It returns an array of records.

```ts
const results = await xata.db.users.search('John');
```

Also you can customize the results with an `options` object that includes `fuzziness`, `filter` and all the other options the API supports.

```ts
const results = await xata.db.users.search('John', { fuzziness: 1, filter: { 'team.name': 'Marketing' } });
```

## Query

To get a collection of records, you can use the `Query` object.

It provides the following methods:

- `getFirst()`: returns the first record in the query results.
- `getPaginated()`: returns a page of records in the query results.
- `getAll()`: returns all the records in the query results.
- `getMany()`: returns an array of some records in the query results.

Since the `Repository` class implements the `Query` interface, you can use it to query and paginate the records in the table too.

```ts
const user = xata.db.users.getFirst();
```

### Column selection

The `Query` object can be used to select the columns that will be returned in the results.

You can pick multiple columns by providing an array of column names, or you can pick all the columns by providing `*`.

The dot notation is supported to select columns from nested objects.

```ts
const user = xata.db.users.select(['*', 'team.*']).getFirst();
```

### Sorting

The `Query` object can be used to sort the order of the results.

You can sort the results by providing a column name and an `asc` or `desc` string.

```ts
const user = xata.db.users.orderBy('fullName', 'asc').getFirst();
```

### Filtering

You can filter the results by providing the column and the value to filter.

```ts
const user = xata.db.users.filter('fullName', 'John').getFirst();
```

To combine multiple filters in an 'AND' clause, you can pipe the filters together.

```ts
const user = xata.db.users.filter('fullName', 'John').filter('team.name', 'Marketing').getFirst();
```

Also you can filter the results by providing a `filter` object.

```ts
const user = xata.db.users.filter({ fullName: 'John', 'team.name': 'Marketing' }).getFirst();
```

We offer some helper functions to build the filter values, like: `gt`, `ge`, `gte`, `lt`, `le`, `lte`, `exists`, `notExists`, `startsWith`, `endsWith`, `pattern`, `is`, `isNot`, `contains`, `includes`, and others specific to the type of the column.

```ts
const user = xata.db.users.filter('name', startsWith('Bar')).getFirst();
```

If you prefer to directly use the filter operators as in the API, you can add them in the `filter` object.

```ts
xata.db.users.filter({ full_name: { $startsWith: 'foo' } }).getFirst();
```

### Combining queries

Queries can be stored in variables and can be combined with other queries.

```ts
const johnQuery = xata.db.users.filter('fullName', 'John');
const janeQuery = xata.db.users.filter('fullName', 'Jane');

const johns = await johnQuery.getAll();
const janes = await janeQuery.getAll();

const users = await xata.db.users.any(johnQuery, janeQuery).getAll();
```

We offer the following helper methods to combine queries:

- `any()`: returns the records that match any of the queries.
- `all()`: returns the records that match all of the queries.
- `none()`: returns the records that match none of the queries.
- `not()`: returns the records that don't match the given query.

You can read more about the query operators in the API section for the query table endpoint.

## Page

Some methods of the `Query` interface provide a `Page` object as a return value that can be used to paginate the results.

The `Page` object can be used to get the queried records of a table in pages. It is an abstraction of cursor-based pagination.

It contains:

- `records`: Array of `XataRecord` objects.
- `hasNextPage`: Function that returns a boolean indicating if there is a next page.
- `nextPage`: Async function that can be used to get the next page.
- `previousPage`: Async function that can be used to get the previous page.
- `firstPage`: Async function that can be used to get the first page.
- `lastPage`: Async function that can be used to get the last page.
- `meta`: Information about the current page and its cursor.

```ts
const page = await xata.db.users.getPaginated();
page.records; // Array of `XataRecord` objects.
page.hasNextPage();

const page2 = await page.nextPage();
page2.records; // Array of `XataRecord` objects.

const page1 = await page2.previousPage();
page1.records; // Array of `XataRecord` objects.

const firstPage = await page1.firstPage();
firstPage.records; // Array of `XataRecord` objects.
```

The `Repository` class implements the `Query` interface, so you can use it to paginate the records in the table too.

```ts
const page = await xata.db.users.firstPage();
page.records; // Array of `XataRecord` objects.
```

The array returned in `records` also implements the `Page` interface.

```ts
const { records } = await xata.db.users.getPaginated();
records.hasNextPage();
const { records: page2Records } = await records.nextPage();
```

Optionally you can provide `offset` and `size` parameters to the pagination and override the default values.

```ts
const page = await xata.db.users.getPaginated();
page.records; // Array of `XataRecord` objects.

// A second page with size 50
const page2 = await page.nextPage(50);

// A third page with size 10 but an offset of 60
const page3 = await page2.nextPage(10, 60);
```

### Iterators and generators

The `Query` object can be used to iterate over the results as a way to paginate the results.

```ts
for await (const user of xata.db.users) {
  await user.update({ full_name: 'John Doe' });
}
```

Also if you want to retrieve more than one record at a time in the iterator, you can use the `getIterator()` method.

```ts
for await (const users of xata.db.users.getIterator({ batchSize: 50 })) {
  console.log(users);
}
```

### Helper variables

We expose some helper variables of the API limits when paginating:

- `PAGINATION_MAX_SIZE`: Maximum page size.
- `PAGINATION_DEFAULT_SIZE`: Default page size.
- `PAGINATION_MAX_OFFSET`: Maximum offset.
- `PAGINATION_DEFAULT_OFFSET`: Default offset.

You can use these variables if you implement your own pagination mechanism, as they will be updated when the API limits are updated.

## XataRecord

Every row in a table is represented by an `XataRecord` object.

It contains an `id` property that represents the unique identifier of the record and all the fields of the table.

Also it provides some methods to read again, update or delete the record.

```ts
const user = await xata.db.users.read('rec_1234abcdef');
user?.id; // 'rec_1234abcdef'
user?.fullName; // 'John Smith'
user?.read(); // Reads the record again
user?.update({ fullName: 'John Doe' }); // Partially updates the record
user?.delete(); // Deletes the record
```

If the table contains a link property, it will be represented as a `Link` object containing its `id` property and methods to read again or update the linked record.

```ts
const user = await xata.db.users.read('rec_1234abcdef');
user?.team?.id; // 'rec_5678defgh'
user?.team?.read(); // Reads the linked record properties
user?.team?.update({ name: 'A team' }); // Partially updates the linked record
```

When working with `queries` you can expand the properties returned in a `XataRecord` object.

By default only the current table fields are returned, and the id of any linked record.

```ts
const user = await xata.db.users.filter('id', 'rec_1234abcdef').select(['*', 'team.*']).getFirst();
user?.id; // 'rec_1234abcdef'
user?.fullName; // 'John Smith'
user?.team?.id; // 'rec_5678defgh'
user?.team?.name; // 'A team'
```
