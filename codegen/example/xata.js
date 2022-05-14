import { buildClient } from "../../client/src";
const links = { teams: [["owner", "users"]], users: [["team", "teams"]] };
/** @typedef { import('./types').DatabaseSchema } DatabaseSchema */
/** @type { import('../../client/src').WrapperConstructor<DatabaseSchema> } */
const DatabaseClient = buildClient();
export class XataClient extends DatabaseClient {
  constructor(options) {
    super(
      { databaseURL: "https://test-r5vcv5.xata.sh/db/test", ...options },
      links
    );
  }
}
