import {
  BaseClient,
  Repository,
  Identifiable,
  RestRespositoryFactory,
  XataClientOptions,
  XataRecord,
} from "../../client/src";

export interface Team extends Identifiable {
  name?: string | null;
  labels?: string[] | null;
  owner?: User | null;
}

export type TeamRecord = Team & XataRecord;

export interface User extends Identifiable {
  email?: string | null;
  full_name?: string | null;
  address?: { street?: string | null; zipcode?: number | null } | null;
  team?: Team | null;
}

export type UserRecord = User & XataRecord;

const links = { teams: [["owner", "users"]], users: [["team", "teams"]] };

export class XataClient extends BaseClient<{
  teams: Repository<TeamRecord>;
  users: Repository<UserRecord>;
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
