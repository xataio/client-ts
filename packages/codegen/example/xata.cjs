"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getXataClient = exports.XataClient = void 0;
// Generated by Xata Codegen 0.26.9. Please do not edit.
const client_1 = require("../../client/src");
/** @typedef { import('./types').SchemaTables } SchemaTables */
/** @type { SchemaTables } */
const tables = [
  {
    name: "teams",
    columns: [
      { name: "name", type: "string" },
      { name: "description", type: "text" },
      { name: "labels", type: "multiple" },
      { name: "index", type: "int" },
      { name: "rating", type: "float" },
      { name: "founded_date", type: "datetime" },
      { name: "email", type: "email" },
      { name: "plan", type: "string" },
      { name: "dark", type: "bool" },
      {
        name: "settings",
        type: "object",
        columns: [
          { name: "plan", type: "string" },
          { name: "dark", type: "bool" },
          { name: "labels", type: "multiple" },
        ],
      },
      { name: "config", type: "json" },
      { name: "owner", type: "link", link: { table: "users" } },
    ],
    revLinks: [{ table: "users", column: "team" }],
  },
  {
    name: "users",
    columns: [
      { name: "email", type: "email", unique: true },
      { name: "name", type: "string" },
      { name: "photo", type: "file" },
      { name: "attachments", type: "file[]" },
      { name: "plan", type: "string" },
      { name: "dark", type: "bool" },
      {
        name: "settings",
        type: "object",
        columns: [
          { name: "plan", type: "string" },
          { name: "dark", type: "bool" },
          { name: "labels", type: "multiple" },
        ],
      },
      {
        name: "full_name",
        type: "string",
        notNull: true,
        defaultValue: "John Doe",
      },
      { name: "index", type: "int" },
      { name: "rating", type: "float" },
      { name: "birthDate", type: "datetime" },
      { name: "street", type: "string" },
      { name: "zipcode", type: "int" },
      {
        name: "address",
        type: "object",
        columns: [
          { name: "street", type: "string" },
          { name: "zipcode", type: "int" },
        ],
      },
      { name: "team", type: "link", link: { table: "teams" } },
      { name: "pet", type: "link", link: { table: "pets" } },
      { name: "account_value", type: "int" },
      { name: "vector", type: "vector", vector: { dimension: 4 } },
    ],
    revLinks: [{ table: "teams", column: "owner" }],
  },
  {
    name: "pets",
    columns: [
      { name: "name", type: "string" },
      { name: "type", type: "string" },
      { name: "num_legs", type: "int" },
    ],
    revLinks: [{ table: "users", column: "pet" }],
  },
];
/** @type { import('../../client/src').ClientConstructor<{}> } */
const DatabaseClient = (0, client_1.buildClient)();
const defaultOptions = {
  databaseURL: "https://test-r5vcv5.eu-west-1.xata.sh/db/test",
};
/** @typedef { import('./types').DatabaseSchema } DatabaseSchema */
/** @extends DatabaseClient<DatabaseSchema> */
class XataClient extends DatabaseClient {
  constructor(options) {
    super({ ...defaultOptions, ...options }, tables);
  }
}
exports.XataClient = XataClient;
let instance = undefined;
/** @type { () => XataClient } */
const getXataClient = () => {
  if (instance) return instance;
  instance = new XataClient();
  return instance;
};
exports.getXataClient = getXataClient;
