import { buildClient } from "../../client/src";
const links = { teams: [["owner", "users"]], users: [["team", "teams"]] };
/** @type { import('../../client/src').ClientConstructor<{}> } */
const DatabaseClient = buildClient();
/** @typedef { import('./types').DatabaseSchema } DatabaseSchema */
/** @extends DatabaseClient<DatabaseSchema> */
export class XataClient extends DatabaseClient {
  constructor(options) {
    super(
      { databaseURL: "https://test-r5vcv5.xata.sh/db/test", ...options },
      links
    );
  }
}
