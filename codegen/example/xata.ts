import {
  BaseClient,
  Query,
  Repository,
  RestRespositoryFactory,
  XataClientOptions,
  XataRecord,
} from "../../client/src";

export interface Team extends XataRecord {
  name?: string;
  labels?: string[];
  owner?: User;
}

export interface User extends XataRecord {
  email?: string;
  full_name?: string;
  address?: { street?: string; zipcode?: number };
  team?: Team;
}

const links = { teams: [["owner", "users"]], users: [["team", "teams"]] };

export class XataClient extends BaseClient<{
  teams: Repository<Team>;
  users: Repository<User>;
}> {
  constructor(options: XataClientOptions) {
    super(
      { databaseURL: "https://test-r5vcv5.xata.sh/db/test", ...options },
      links
    );
    const factory = options.repositoryFactory || new RestRespositoryFactory();
    this.db = {
      teams: factory.createRepository(this, "teams"),
      users: factory.createRepository(this, "users"),
    };
  }
}
