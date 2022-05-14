import { buildClient } from "../../client/src";
const links = { teams: [["owner", "users"]], users: [["team", "teams"]] };
/** @typedef { import('./types').DatabaseSchema } DatabaseSchema */
/** @typedef { import('../../client/src').SchemaPlugin<DatabaseSchema> } SchemaPlugin */
/** @typedef { import('../../client/src').SearchPlugin<DatabaseSchema> } SearchPlugin */
/** @typedef { { db: SchemaPlugin, search: SearchPlugin }} BuiltinPlugins */
/** @type { import('../../client/src').WrapperConstructor<DatabaseSchema, BuiltinPlugins> } */
const DatabaseClient = buildClient();
export class XataClient extends DatabaseClient {
  constructor(options) {
    super(
      { databaseURL: "https://test-r5vcv5.xata.sh/db/test", ...options },
      links
    );
  }
}
