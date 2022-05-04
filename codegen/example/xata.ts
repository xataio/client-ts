import {
  BaseClient,
  Repository,
  RestRespositoryFactory,
  XataClientOptions,
  XataRecord,
} from "../../client/src";

export interface Team {
  name?: string | null;
  labels?: string[] | null;
  owner?: User | null;
}

export type TeamRecord = Team & XataRecord;

export interface User {
  email?: string | null;
  full_name?: string | null;
  address?: { street?: string | null; zipcode?: number | null } | null;
  team?: Team | null;
}

export type UserRecord = User & XataRecord;

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

export function createMigration() {
  return {
    tables: {
      teams: {
        columns: {
          name: {
            rename(name: string) {},
            delete() {},
          },
          labels: {
            rename(name: string) {},
            delete() {},
          },
          owner: {
            rename(name: string) {},
            delete() {},
          },
        },
        delete() {},
        rename(name: string) {},
        addColumn(options: { name: string; type: ColumnType }) {},
      },
      users: {
        columns: {
          email: {
            rename(name: string) {},
            delete() {},
          },
          full_name: {
            rename(name: string) {},
            delete() {},
          },
          address: {
            rename(name: string) {},
            delete() {},
          },
          team: {
            rename(name: string) {},
            delete() {},
          },
        },
        delete() {},
        rename(name: string) {},
        addColumn(options: { name: string; type: ColumnType }) {},
      },
    },
    addTable(options: {
      name: string;
      columns: { name: string; type: ColumnType }[];
    }) {},
    run() {},
  };
}

// TODO: get from open api spec
type ColumnType =
  | "int"
  | "float"
  | "email"
  | "string"
  | "text"
  | "multiple"
  | "bool";
