import { BaseClient, Query, Repository, RestRespositoryFactory, XataClientOptions, XataRecord } from '@xata.io/client';

export interface User extends XataRecord {
  name?: string;
  email?: string;
  avatar_url?: string;
  notion_id?: string;
}

const links = { users: [] };

export class XataClient extends BaseClient<{
  users: Repository<User>;
}> {
  constructor(options: XataClientOptions) {
    super(options, links);
    const factory = options.repositoryFactory || new RestRespositoryFactory();
    this.db = {
      users: factory.createRepository(this, 'users')
    };
  }
}
