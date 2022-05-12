import { BaseClient, RestRespositoryFactory } from "../../client/src";
/** @typedef { import('./types').Team } Team */
/** @typedef { import('./types').TeamRecord } TeamRecord */
/** @typedef { import('../../client/src').Repository<Team, TeamRecord> } TeamRepository */
/** @typedef { import('./types').User } User */
/** @typedef { import('./types').UserRecord } UserRecord */
/** @typedef { import('../../client/src').Repository<User, UserRecord> } UserRepository */
/** @typedef { import('./types').Foobar } Foobar */
/** @typedef { import('./types').FoobarRecord } FoobarRecord */
/** @typedef { import('../../client/src').Repository<Foobar, FoobarRecord> } FoobarRepository */
/** @typedef { import('./types').Nasdaq } Nasdaq */
/** @typedef { import('./types').NasdaqRecord } NasdaqRecord */
/** @typedef { import('../../client/src').Repository<Nasdaq, NasdaqRecord> } NasdaqRepository */
const links = {
  teams: [["owner", "users"]],
  users: [["team", "teams"]],
  foobar: [],
  nasdaq: [],
};
export class XataClient extends BaseClient {
  constructor(options) {
    super(
      { databaseURL: "https://test-r5vcv5.xata.sh/db/test", ...options },
      links
    );
    const factory = options?.repositoryFactory || new RestRespositoryFactory();
    /** @type {{ "teams": TeamRepository; "users": UserRepository; "foobar": FoobarRepository; "nasdaq": NasdaqRepository }} */
    this.db = {
      teams: factory.createRepository(this, "teams", links),
      users: factory.createRepository(this, "users", links),
      foobar: factory.createRepository(this, "foobar", links),
      nasdaq: factory.createRepository(this, "nasdaq", links),
    };
  }
}
