# Xata TypeScript SDK

There're four types of objects in the Xata TypeScript SDK:

    * `Repository`: a table representation that can be used to create, read, update, and delete records.
    * `Query`: a combination of filters and other parameters to retrieve a collection of records.
    * `XataRecord`: a row in a table.
    * `Page`: a collection of records that can be paginated.

## Repository

Any table in the database can be represented by a `Repository` object.

A repository is an object that can be used to create, read, update, and delete records in the table it represents.

It also implements the `Query` and `Page` interfaces, so you can use it to query and paginate the records in the table too. We'll see how to use these objects in the next section.

### Reading records

The `read()` method can be used to read a records by their ids:

    * If the object cannot be found, the method will return `null`.
    * If the object can be found, the method will return a `XataRecord` object.

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

    * The `create()` method will create a new record and fail if the provided id already exists.
    * The `createOrUpdate()` method will create a new record if the provided id doesn't exist, or update an existing record if it does.

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
const users = await xata.db.users.create([{ fullName: 'John Smith' }, { fullName: 'Jane Doe' }]);
users[0].id; // 'rec_1234abcdef'
users[1].id; // 'rec_5678defgh'
```

### Updating records

### Deleting records

## Query

## Page

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
