import { BaseClient } from '..';
import { Query, Select, Selectable } from './query';
import { XataObject } from './xataObject';

export class SchemaRepository<T> extends Query<T, Selectable<T>> {
  client: BaseClient<any>;

  constructor(client: BaseClient<any>, table: string) {
    super(null, table, {});
    this.client = client;

    Object.defineProperty(this, 'client', { enumerable: false });
  }

  select<K extends keyof T>(...columns: K[]) {
    return new Query<T, Select<T, K>>(this.repository, this.table, {});
  }

  async create(object: T): Promise<T & XataObject> {
    const workspace = await this.client.getWorkspaceId();
    const database = await this.client.getDatabaseId();
    const branch = await this.client.getBranch();

    const record = transformObjectLinks(object);

    const response = await this.client.api.records.insertRecord(workspace, database, branch, this.table, record);

    const finalObject = await this.read(response.id);
    if (!finalObject) {
      throw new Error('The server failed to save the record');
    }

    return finalObject;
  }

  async createMany(objects: T[]): Promise<(T & XataObject)[]> {
    const workspace = await this.client.getWorkspaceId();
    const database = await this.client.getDatabaseId();
    const branch = await this.client.getBranch();

    const records = objects.map((object) => transformObjectLinks(object));

    const response = await this.client.api.records.bulkInsertTableRecords(
      workspace,
      database,
      branch,
      this.table,
      records
    );

    // TODO: Use filer.$any() to get all the records
    const finalObjects = await Promise.all(response.recordIDs.map((id) => this.read(id)));
    if (finalObjects.some((object) => !object)) {
      throw new Error('The server failed to save the record');
    }

    return finalObjects as (T & XataObject)[];
  }

  async read(id: string): Promise<(T & XataObject) | null> {
    const workspace = await this.client.getWorkspaceId();
    const database = await this.client.getDatabaseId();
    const branch = await this.client.getBranch();

    const response = await this.client.api.records.getRecord(workspace, database, branch, this.table, id);

    return this.client.initObject(this.table, response);
  }

  async update(id: string, object: Partial<T>): Promise<T & XataObject> {
    const workspace = await this.client.getWorkspaceId();
    const database = await this.client.getDatabaseId();
    const branch = await this.client.getBranch();

    const response = await this.client.api.records.insertRecordWithID(
      workspace,
      database,
      branch,
      this.table,
      id,
      object
    );

    // TODO: Review this, not sure we are properly initializing the object
    return this.client.initObject(this.table, response);
  }

  async delete(id: string) {
    const workspace = await this.client.getWorkspaceId();
    const database = await this.client.getDatabaseId();
    const branch = await this.client.getBranch();

    await this.client.api.records.deleteRecord(workspace, database, branch, this.table, id);
  }
}

// TODO: We can find a better implementation for links
const transformObjectLinks = (object: any) => {
  return Object.entries(object).reduce((acc, [key, value]) => {
    if (value && typeof value === 'object' && typeof (value as Record<string, unknown>).id === 'string') {
      return { ...acc, [key]: (value as XataObject).id };
    }

    return { ...acc, [key]: value };
  }, {});
};
