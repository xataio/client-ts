import { buildClient } from "../../client/src";
const links = { teams: [["owner", "users"]], users: [["team", "teams"]] };
/** @typedef { import('./types').DatabaseSchema } DatabaseSchema */
/** @typedef { import('../../client/src').SchemaNamespace<DatabaseSchema> } SchemaNamespace */
/** @typedef { import('../../client/src').SearchNamespace<DatabaseSchema> } SearchNamespace */
/** @typedef { { db: SchemaNamespace, search: SearchNamespace }} Namespaces */
/** @type { import('../../client/src').WrapperConstructor<DatabaseSchema, Namespaces> } */
const DatabaseClient = buildClient();
export class XataClient extends DatabaseClient {
  constructor(options) {
    super(
      { databaseURL: "https://test-r5vcv5.xata.sh/db/test", ...options },
      links
    );
  }
}
