/** @typedef { import('../../client/src').Repository } Repository */
import { BaseClient, RestRespositoryFactory } from "../../client/src";
/**
 * @typedef {Object} Team
 * @property {string} id
 * @property {Object} xata
 * @property {() => Promise<Team>} read
 * @property {() => Promise<Team>} update
 * @property {() => Promise<void>} delete
 * @property {string=} name
 * @property {string[]=} labels
 * @property {User=} owner
 
 */
/**
 * @typedef {Object} User
 * @property {string} id
 * @property {Object} xata
 * @property {() => Promise<User>} read
 * @property {() => Promise<User>} update
 * @property {() => Promise<void>} delete
 * @property {string=} email
 * @property {string=} full_name
 * @property {{ street?: string | null; zipcode?: number | null }=} address
 * @property {Team=} team
 
 */
const links = { teams: [["owner", "users"]], users: [["team", "teams"]] };
export class XataClient extends BaseClient {
  constructor(options) {
    super(
      { databaseURL: "https://test-r5vcv5.xata.sh/db/test", ...options },
      links
    );
    const factory = options.repositoryFactory || new RestRespositoryFactory();
    /** @type {{ "teams": Repository; "users": Repository }} */
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
            rename(name) {},
            delete() {},
          },
          labels: {
            rename(name) {},
            delete() {},
          },
          owner: {
            rename(name) {},
            delete() {},
          },
        },
        delete() {},
        rename(name) {},
        addColumn(options) {},
      },
      users: {
        columns: {
          email: {
            rename(name) {},
            delete() {},
          },
          full_name: {
            rename(name) {},
            delete() {},
          },
          address: {
            rename(name) {},
            delete() {},
          },
          team: {
            rename(name) {},
            delete() {},
          },
        },
        delete() {},
        rename(name) {},
        addColumn(options) {},
      },
    },
    addTable(options) {},
    run() {},
  };
}
