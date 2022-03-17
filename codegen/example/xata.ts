import { BaseClient, Schema, SchemaFactory, XataClientOptions } from '../../client/src';

export interface Team {
  name?: string;
  labels?: string[];
  owner?: User;
}

export interface User {
  email?: string;
  full_name?: string;
  address?: { street?: string; zipcode?: number };
  team?: Team;
}

const links = { teams: [['owner', 'users']], users: [['team', 'teams']] };

export class XataClient extends BaseClient<{
  teams: Schema<Team>;
  users: Schema<User>;
}> {
  constructor(options: XataClientOptions) {
    super(options, links);
    const factory = options.repositoryFactory || new SchemaFactory();
    this.db = {
      teams: factory.createRepository(this, 'teams'),
      users: factory.createRepository(this, 'users')
    };
  }
}
