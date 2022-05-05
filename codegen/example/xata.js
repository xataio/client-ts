import { BaseClient, RestRespositoryFactory } from "../../client/src";
/** @typedef { import('./types').Team } Team */
/** @typedef { import('./types').TeamRecord } TeamRecord */
/** @typedef { import('../../client/src').Repository<Team, TeamRecord> } TeamRepository */
/** @typedef { import('./types').User } User */
/** @typedef { import('./types').UserRecord } UserRecord */
/** @typedef { import('../../client/src').Repository<User, UserRecord> } UserRepository */
const links = { teams: [["owner", "users"]], users: [["team", "teams"]] };
export class XataClient extends BaseClient {
  constructor(options) {
    super(
      { databaseURL: "https://test-r5vcv5.xata.sh/db/test", ...options },
      links
    );
    const factory = options.repositoryFactory || new RestRespositoryFactory();
    function generateJSDocInternalType(tables) {
      return `/** @type {{ ${tables
        .map((table) => `"${table.name}": ${getTypeName(table.name)}Repository`)
        .join("; ")} }} */`;
    }
    this.db = {
      teams: factory.createRepository(this, "teams"),
      users: factory.createRepository(this, "users"),
    };
  }
}
