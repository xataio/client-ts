import { defaultTrace, TraceFunction } from '../schema/tracing';
import { getAPIKey } from '../util/apiKey';
import { getFetchImplementation } from '../util/fetch';
import { isString } from '../util/lang';
import type * as Components from './components';
import type * as Types from './components';
import { operationsByTag } from './components';
import type { FetcherExtraProps, FetchImpl } from './fetcher';
import { getHostUrl, HostProvider } from './providers';
import type * as Responses from './responses';
import type * as Schemas from './schemas';

export interface XataApiClientOptions {
  fetch?: FetchImpl;
  apiKey?: string;
  host?: HostProvider;
  trace?: TraceFunction;
}

export class XataApiClient {
  #extraProps: FetcherExtraProps;
  #namespaces: Partial<{
    user: UserApi;
    authentication: AuthenticationApi;
    workspaces: WorkspaceApi;
    invites: InvitesApi;
    database: DatabaseApi;
    branches: BranchApi;
    migrations: MigrationsApi;
    migrationRequests: MigrationRequestsApi;
    tables: TableApi;
    records: RecordsApi;
    searchAndFilter: SearchAndFilterApi;
    databases: DatabasesApi;
  }> = {};

  constructor(options: XataApiClientOptions = {}) {
    const provider = options.host ?? 'production';
    const apiKey = options.apiKey ?? getAPIKey();
    const trace = options.trace ?? defaultTrace;

    if (!apiKey) {
      throw new Error('Could not resolve a valid apiKey');
    }

    this.#extraProps = {
      apiUrl: getHostUrl(provider, 'main'),
      workspacesApiUrl: getHostUrl(provider, 'workspaces'),
      fetchImpl: getFetchImplementation(options.fetch),
      apiKey,
      trace
    };
  }

  public get user() {
    if (!this.#namespaces.user) this.#namespaces.user = new UserApi(this.#extraProps);
    return this.#namespaces.user;
  }

  public get authentication() {
    if (!this.#namespaces.authentication) this.#namespaces.authentication = new AuthenticationApi(this.#extraProps);
    return this.#namespaces.authentication;
  }

  public get workspaces() {
    if (!this.#namespaces.workspaces) this.#namespaces.workspaces = new WorkspaceApi(this.#extraProps);
    return this.#namespaces.workspaces;
  }

  public get invites() {
    if (!this.#namespaces.invites) this.#namespaces.invites = new InvitesApi(this.#extraProps);
    return this.#namespaces.invites;
  }

  public get database() {
    if (!this.#namespaces.database) this.#namespaces.database = new DatabaseApi(this.#extraProps);
    return this.#namespaces.database;
  }

  public get branches() {
    if (!this.#namespaces.branches) this.#namespaces.branches = new BranchApi(this.#extraProps);
    return this.#namespaces.branches;
  }

  public get migrations() {
    if (!this.#namespaces.migrations) this.#namespaces.migrations = new MigrationsApi(this.#extraProps);
    return this.#namespaces.migrations;
  }

  public get migrationRequests() {
    if (!this.#namespaces.migrationRequests)
      this.#namespaces.migrationRequests = new MigrationRequestsApi(this.#extraProps);
    return this.#namespaces.migrationRequests;
  }

  public get tables() {
    if (!this.#namespaces.tables) this.#namespaces.tables = new TableApi(this.#extraProps);
    return this.#namespaces.tables;
  }

  public get records() {
    if (!this.#namespaces.records) this.#namespaces.records = new RecordsApi(this.#extraProps);
    return this.#namespaces.records;
  }

  public get searchAndFilter() {
    if (!this.#namespaces.searchAndFilter) this.#namespaces.searchAndFilter = new SearchAndFilterApi(this.#extraProps);
    return this.#namespaces.searchAndFilter;
  }

  public get databases() {
    if (!this.#namespaces.databases) this.#namespaces.databases = new DatabasesApi(this.#extraProps);
    return this.#namespaces.databases;
  }
}

class UserApi {
  constructor(private extraProps: FetcherExtraProps) {}

  public getUser(): Promise<Schemas.UserWithID> {
    return operationsByTag.users.getUser({ ...this.extraProps });
  }

  public updateUser(user: Schemas.User): Promise<Schemas.UserWithID> {
    return operationsByTag.users.updateUser({ body: user, ...this.extraProps });
  }

  public deleteUser(): Promise<void> {
    return operationsByTag.users.deleteUser({ ...this.extraProps });
  }
}

class AuthenticationApi {
  constructor(private extraProps: FetcherExtraProps) {}

  public getUserAPIKeys(): Promise<Types.GetUserAPIKeysResponse> {
    return operationsByTag.authentication.getUserAPIKeys({ ...this.extraProps });
  }

  public createUserAPIKey(keyName: Schemas.APIKeyName): Promise<Types.CreateUserAPIKeyResponse> {
    return operationsByTag.authentication.createUserAPIKey({
      pathParams: { keyName },
      ...this.extraProps
    });
  }

  public deleteUserAPIKey(keyName: Schemas.APIKeyName): Promise<void> {
    return operationsByTag.authentication.deleteUserAPIKey({
      pathParams: { keyName },
      ...this.extraProps
    });
  }
}

class WorkspaceApi {
  constructor(private extraProps: FetcherExtraProps) {}

  public getWorkspacesList(): Promise<Types.GetWorkspacesListResponse> {
    return operationsByTag.workspaces.getWorkspacesList({ ...this.extraProps });
  }

  public createWorkspace(workspaceMeta: Schemas.WorkspaceMeta): Promise<Schemas.Workspace> {
    return operationsByTag.workspaces.createWorkspace({
      body: workspaceMeta,
      ...this.extraProps
    });
  }

  public getWorkspace(workspaceId: Schemas.WorkspaceID): Promise<Schemas.Workspace> {
    return operationsByTag.workspaces.getWorkspace({
      pathParams: { workspaceId },
      ...this.extraProps
    });
  }

  public updateWorkspace(
    workspaceId: Schemas.WorkspaceID,
    workspaceMeta: Schemas.WorkspaceMeta
  ): Promise<Schemas.Workspace> {
    return operationsByTag.workspaces.updateWorkspace({
      pathParams: { workspaceId },
      body: workspaceMeta,
      ...this.extraProps
    });
  }

  public deleteWorkspace(workspaceId: Schemas.WorkspaceID): Promise<void> {
    return operationsByTag.workspaces.deleteWorkspace({
      pathParams: { workspaceId },
      ...this.extraProps
    });
  }

  public getWorkspaceMembersList(workspaceId: Schemas.WorkspaceID): Promise<Schemas.WorkspaceMembers> {
    return operationsByTag.workspaces.getWorkspaceMembersList({
      pathParams: { workspaceId },
      ...this.extraProps
    });
  }

  public updateWorkspaceMemberRole(
    workspaceId: Schemas.WorkspaceID,
    userId: Schemas.UserID,
    role: Schemas.Role
  ): Promise<void> {
    return operationsByTag.workspaces.updateWorkspaceMemberRole({
      pathParams: { workspaceId, userId },
      body: { role },
      ...this.extraProps
    });
  }

  public removeWorkspaceMember(workspaceId: Schemas.WorkspaceID, userId: Schemas.UserID): Promise<void> {
    return operationsByTag.workspaces.removeWorkspaceMember({
      pathParams: { workspaceId, userId },
      ...this.extraProps
    });
  }
}

class InvitesApi {
  constructor(private extraProps: FetcherExtraProps) {}

  public inviteWorkspaceMember(
    workspaceId: Schemas.WorkspaceID,
    email: string,
    role: Schemas.Role
  ): Promise<Schemas.WorkspaceInvite> {
    return operationsByTag.invites.inviteWorkspaceMember({
      pathParams: { workspaceId },
      body: { email, role },
      ...this.extraProps
    });
  }

  public updateWorkspaceMemberInvite(
    workspaceId: Schemas.WorkspaceID,
    inviteId: Schemas.InviteID,
    role: Schemas.Role
  ): Promise<Schemas.WorkspaceInvite> {
    return operationsByTag.invites.updateWorkspaceMemberInvite({
      pathParams: { workspaceId, inviteId },
      body: { role },
      ...this.extraProps
    });
  }

  public cancelWorkspaceMemberInvite(workspaceId: Schemas.WorkspaceID, inviteId: Schemas.InviteID): Promise<void> {
    return operationsByTag.invites.cancelWorkspaceMemberInvite({
      pathParams: { workspaceId, inviteId },
      ...this.extraProps
    });
  }

  public acceptWorkspaceMemberInvite(workspaceId: Schemas.WorkspaceID, inviteKey: Schemas.InviteKey): Promise<void> {
    return operationsByTag.invites.acceptWorkspaceMemberInvite({
      pathParams: { workspaceId, inviteKey },
      ...this.extraProps
    });
  }

  public resendWorkspaceMemberInvite(workspaceId: Schemas.WorkspaceID, inviteId: Schemas.InviteID): Promise<void> {
    return operationsByTag.invites.resendWorkspaceMemberInvite({
      pathParams: { workspaceId, inviteId },
      ...this.extraProps
    });
  }
}

class DatabaseApi {
  constructor(private extraProps: FetcherExtraProps) {}

  public getDatabaseList(workspace: Schemas.WorkspaceID): Promise<Schemas.ListDatabasesResponse> {
    return operationsByTag.database.getDatabaseList({
      pathParams: { workspace },
      ...this.extraProps
    });
  }

  public createDatabase(
    workspace: Schemas.WorkspaceID,
    dbName: Schemas.DBName,
    options: Types.CreateDatabaseRequestBody = {}
  ): Promise<Types.CreateDatabaseResponse> {
    return operationsByTag.database.createDatabase({
      pathParams: { workspace, dbName },
      body: options,
      ...this.extraProps
    });
  }

  public deleteDatabase(workspace: Schemas.WorkspaceID, dbName: Schemas.DBName): Promise<void> {
    return operationsByTag.database.deleteDatabase({
      pathParams: { workspace, dbName },
      ...this.extraProps
    });
  }

  public getDatabaseMetadata(
    workspace: Schemas.WorkspaceID,
    dbName: Schemas.DBName
  ): Promise<Schemas.DatabaseMetadata> {
    return operationsByTag.database.getDatabaseMetadata({
      pathParams: { workspace, dbName },
      ...this.extraProps
    });
  }

  public updateDatabaseMetadata(
    workspace: Schemas.WorkspaceID,
    dbName: Schemas.DBName,
    options: Types.UpdateDatabaseMetadataRequestBody = {}
  ): Promise<Schemas.DatabaseMetadata> {
    return operationsByTag.database.updateDatabaseMetadata({
      pathParams: { workspace, dbName },
      body: options,
      ...this.extraProps
    });
  }
}

class BranchApi {
  constructor(private extraProps: FetcherExtraProps) {}

  public getBranchList(workspace: Schemas.WorkspaceID, dbName: Schemas.DBName): Promise<Schemas.ListBranchesResponse> {
    return operationsByTag.branch.getBranchList({
      pathParams: { workspace, dbName },
      ...this.extraProps
    });
  }

  public getBranchDetails(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName
  ): Promise<Schemas.DBBranch> {
    return operationsByTag.branch.getBranchDetails({
      pathParams: { workspace, dbBranchName: `${database}:${branch}` },
      ...this.extraProps
    });
  }

  public createBranch(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    from?: string,
    options: Types.CreateBranchRequestBody = {}
  ): Promise<Types.CreateBranchResponse> {
    return operationsByTag.branch.createBranch({
      pathParams: { workspace, dbBranchName: `${database}:${branch}` },
      queryParams: isString(from) ? { from } : undefined,
      body: options,
      ...this.extraProps
    });
  }

  public deleteBranch(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName
  ): Promise<void> {
    return operationsByTag.branch.deleteBranch({
      pathParams: { workspace, dbBranchName: `${database}:${branch}` },
      ...this.extraProps
    });
  }

  public updateBranchMetadata(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    metadata: Schemas.BranchMetadata = {}
  ): Promise<void> {
    return operationsByTag.branch.updateBranchMetadata({
      pathParams: { workspace, dbBranchName: `${database}:${branch}` },
      body: metadata,
      ...this.extraProps
    });
  }

  public getBranchMetadata(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName
  ): Promise<Schemas.BranchMetadata> {
    return operationsByTag.branch.getBranchMetadata({
      pathParams: { workspace, dbBranchName: `${database}:${branch}` },
      ...this.extraProps
    });
  }

  public getBranchStats(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName
  ): Promise<Types.GetBranchStatsResponse> {
    return operationsByTag.branch.getBranchStats({
      pathParams: { workspace, dbBranchName: `${database}:${branch}` },
      ...this.extraProps
    });
  }

  public getGitBranchesMapping(
    workspace: Schemas.WorkspaceID,
    dbName: Schemas.DBName
  ): Promise<Schemas.ListGitBranchesResponse> {
    return operationsByTag.branch.getGitBranchesMapping({
      pathParams: { workspace, dbName },
      ...this.extraProps
    });
  }

  public addGitBranchesEntry(
    workspace: Schemas.WorkspaceID,
    dbName: Schemas.DBName,
    body: Types.AddGitBranchesEntryRequestBody
  ): Promise<Types.AddGitBranchesEntryResponse> {
    return operationsByTag.branch.addGitBranchesEntry({
      pathParams: { workspace, dbName },
      body,
      ...this.extraProps
    });
  }

  public removeGitBranchesEntry(
    workspace: Schemas.WorkspaceID,
    dbName: Schemas.DBName,
    gitBranch: string
  ): Promise<void> {
    return operationsByTag.branch.removeGitBranchesEntry({
      pathParams: { workspace, dbName },
      queryParams: { gitBranch },
      ...this.extraProps
    });
  }

  public resolveBranch(
    workspace: Schemas.WorkspaceID,
    dbName: Schemas.DBName,
    gitBranch?: string,
    fallbackBranch?: string
  ): Promise<Types.ResolveBranchResponse> {
    return operationsByTag.branch.resolveBranch({
      pathParams: { workspace, dbName },
      queryParams: { gitBranch, fallbackBranch },
      ...this.extraProps
    });
  }
}

class TableApi {
  constructor(private extraProps: FetcherExtraProps) {}

  public createTable(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName
  ): Promise<Types.CreateTableResponse> {
    return operationsByTag.table.createTable({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName },
      ...this.extraProps
    });
  }

  public deleteTable(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName
  ): Promise<void> {
    return operationsByTag.table.deleteTable({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName },
      ...this.extraProps
    });
  }

  public updateTable(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    options: Types.UpdateTableRequestBody
  ): Promise<void> {
    return operationsByTag.table.updateTable({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName },
      body: options,
      ...this.extraProps
    });
  }

  public getTableSchema(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName
  ): Promise<Types.GetTableSchemaResponse> {
    return operationsByTag.table.getTableSchema({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName },
      ...this.extraProps
    });
  }

  public setTableSchema(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    options: Types.SetTableSchemaRequestBody
  ): Promise<void> {
    return operationsByTag.table.setTableSchema({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName },
      body: options,
      ...this.extraProps
    });
  }

  public getTableColumns(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName
  ): Promise<Types.GetTableColumnsResponse> {
    return operationsByTag.table.getTableColumns({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName },
      ...this.extraProps
    });
  }

  public addTableColumn(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    column: Schemas.Column
  ): Promise<Responses.MigrationIdResponse> {
    return operationsByTag.table.addTableColumn({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName },
      body: column,
      ...this.extraProps
    });
  }

  public getColumn(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    columnName: Schemas.ColumnName
  ): Promise<Schemas.Column> {
    return operationsByTag.table.getColumn({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName, columnName },
      ...this.extraProps
    });
  }

  public updateColumn(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    columnName: Schemas.ColumnName,
    options: Types.UpdateColumnRequestBody
  ): Promise<Responses.MigrationIdResponse> {
    return operationsByTag.table.updateColumn({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName, columnName },
      body: options,
      ...this.extraProps
    });
  }

  public deleteColumn(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    columnName: Schemas.ColumnName
  ): Promise<Responses.MigrationIdResponse> {
    return operationsByTag.table.deleteColumn({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName, columnName },
      ...this.extraProps
    });
  }
}

class RecordsApi {
  constructor(private extraProps: FetcherExtraProps) {}

  public insertRecord(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    record: Record<string, any>,
    options: Types.InsertRecordQueryParams = {}
  ): Promise<Responses.RecordUpdateResponse> {
    return operationsByTag.records.insertRecord({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName },
      queryParams: options,
      body: record,
      ...this.extraProps
    });
  }

  public getRecord(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    recordId: Schemas.RecordID,
    options: Types.GetRecordQueryParams = {}
  ): Promise<Schemas.XataRecord> {
    return operationsByTag.records.getRecord({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName, recordId },
      queryParams: options,
      ...this.extraProps
    });
  }

  public insertRecordWithID(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    recordId: Schemas.RecordID,
    record: Record<string, any>,
    options: Types.InsertRecordWithIDQueryParams = {}
  ): Promise<Responses.RecordUpdateResponse> {
    return operationsByTag.records.insertRecordWithID({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName, recordId },
      queryParams: options,
      body: record,
      ...this.extraProps
    });
  }

  public updateRecordWithID(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    recordId: Schemas.RecordID,
    record: Record<string, any>,
    options: Types.UpdateRecordWithIDQueryParams = {}
  ): Promise<Responses.RecordUpdateResponse> {
    return operationsByTag.records.updateRecordWithID({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName, recordId },
      queryParams: options,
      body: record,
      ...this.extraProps
    });
  }

  public upsertRecordWithID(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    recordId: Schemas.RecordID,
    record: Record<string, any>,
    options: Types.UpsertRecordWithIDQueryParams = {}
  ): Promise<Responses.RecordUpdateResponse> {
    return operationsByTag.records.upsertRecordWithID({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName, recordId },
      queryParams: options,
      body: record,
      ...this.extraProps
    });
  }

  public deleteRecord(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    recordId: Schemas.RecordID,
    options: Types.DeleteRecordQueryParams = {}
  ): Promise<Responses.RecordUpdateResponse> {
    return operationsByTag.records.deleteRecord({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName, recordId },
      queryParams: options,
      ...this.extraProps
    });
  }

  public bulkInsertTableRecords(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    records: Record<string, any>[],
    options: Types.BulkInsertTableRecordsQueryParams = {}
  ): Promise<Responses.BulkInsertResponse> {
    return operationsByTag.records.bulkInsertTableRecords({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName },
      queryParams: options,
      body: { records },
      ...this.extraProps
    });
  }
}

class SearchAndFilterApi {
  constructor(private extraProps: FetcherExtraProps) {}

  public queryTable(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    query: Types.QueryTableRequestBody
  ): Promise<Responses.QueryResponse> {
    return operationsByTag.searchAndFilter.queryTable({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName },
      body: query,
      ...this.extraProps
    });
  }

  public searchTable(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    query: Types.SearchTableRequestBody
  ): Promise<Responses.SearchResponse> {
    return operationsByTag.searchAndFilter.searchTable({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName },
      body: query,
      ...this.extraProps
    });
  }

  public searchBranch(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    query: Types.SearchBranchRequestBody
  ): Promise<Responses.SearchResponse> {
    return operationsByTag.searchAndFilter.searchBranch({
      pathParams: { workspace, dbBranchName: `${database}:${branch}` },
      body: query,
      ...this.extraProps
    });
  }

  public summarizeTable(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    query: Types.SummarizeTableRequestBody
  ): Promise<Responses.SummarizeResponse> {
    return operationsByTag.searchAndFilter.summarizeTable({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName },
      body: query,
      ...this.extraProps
    });
  }

  public aggregateTable(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    query: Types.AggregateTableRequestBody
  ): Promise<Responses.AggResponse> {
    return operationsByTag.searchAndFilter.aggregateTable({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName },
      body: query,
      ...this.extraProps
    });
  }
}

class MigrationRequestsApi {
  constructor(private extraProps: FetcherExtraProps) {}

  public queryMigrationRequests(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    options: Types.QueryMigrationRequestsRequestBody = {}
  ): Promise<Components.QueryMigrationRequestsResponse> {
    return operationsByTag.migrationRequests.queryMigrationRequests({
      pathParams: { workspace, dbName: database },
      body: options,
      ...this.extraProps
    });
  }

  public createMigrationRequest(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    options: Components.CreateMigrationRequestRequestBody
  ): Promise<Components.CreateMigrationRequestResponse> {
    return operationsByTag.migrationRequests.createMigrationRequest({
      pathParams: { workspace, dbName: database },
      body: options,
      ...this.extraProps
    });
  }

  public getMigrationRequest(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    migrationRequest: number
  ): Promise<Schemas.MigrationRequest> {
    return operationsByTag.migrationRequests.getMigrationRequest({
      pathParams: { workspace, dbName: database, mrNumber: migrationRequest },
      ...this.extraProps
    });
  }

  public updateMigrationRequest(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    migrationRequest: number,
    options: Components.UpdateMigrationRequestRequestBody
  ): Promise<void> {
    return operationsByTag.migrationRequests.updateMigrationRequest({
      pathParams: { workspace, dbName: database, mrNumber: migrationRequest },
      body: options,
      ...this.extraProps
    });
  }

  public listMigrationRequestsCommits(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    migrationRequest: number,
    options: Types.ListMigrationRequestsCommitsRequestBody = {}
  ): Promise<Components.ListMigrationRequestsCommitsResponse> {
    return operationsByTag.migrationRequests.listMigrationRequestsCommits({
      pathParams: { workspace, dbName: database, mrNumber: migrationRequest },
      body: options,
      ...this.extraProps
    });
  }

  public compareMigrationRequest(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    migrationRequest: number
  ): Promise<Responses.SchemaCompareResponse> {
    return operationsByTag.migrationRequests.compareMigrationRequest({
      pathParams: { workspace, dbName: database, mrNumber: migrationRequest },
      ...this.extraProps
    });
  }

  public getMigrationRequestIsMerged(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    migrationRequest: number
  ): Promise<Components.GetMigrationRequestIsMergedResponse> {
    return operationsByTag.migrationRequests.getMigrationRequestIsMerged({
      pathParams: { workspace, dbName: database, mrNumber: migrationRequest },
      ...this.extraProps
    });
  }

  public mergeMigrationRequest(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    migrationRequest: number
  ): Promise<Schemas.Commit> {
    return operationsByTag.migrationRequests.mergeMigrationRequest({
      pathParams: { workspace, dbName: database, mrNumber: migrationRequest },
      ...this.extraProps
    });
  }
}

class MigrationsApi {
  constructor(private extraProps: FetcherExtraProps) {}

  public getBranchMigrationHistory(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    options: Types.GetBranchMigrationHistoryRequestBody = {}
  ): Promise<Types.GetBranchMigrationHistoryResponse> {
    return operationsByTag.migrations.getBranchMigrationHistory({
      pathParams: { workspace, dbBranchName: `${database}:${branch}` },
      body: options,
      ...this.extraProps
    });
  }

  public getBranchMigrationPlan(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    schema: Schemas.Schema
  ): Promise<Responses.BranchMigrationPlan> {
    return operationsByTag.migrations.getBranchMigrationPlan({
      pathParams: { workspace, dbBranchName: `${database}:${branch}` },
      body: schema,
      ...this.extraProps
    });
  }

  public executeBranchMigrationPlan(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    migrationPlan: Types.ExecuteBranchMigrationPlanRequestBody
  ): Promise<void> {
    return operationsByTag.migrations.executeBranchMigrationPlan({
      pathParams: { workspace, dbBranchName: `${database}:${branch}` },
      body: migrationPlan,
      ...this.extraProps
    });
  }

  public getBranchSchemaHistory(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    options: Types.GetBranchSchemaHistoryRequestBody = {}
  ): Promise<Types.GetBranchSchemaHistoryResponse> {
    return operationsByTag.migrations.getBranchSchemaHistory({
      pathParams: { workspace, dbBranchName: `${database}:${branch}` },
      body: options,
      ...this.extraProps
    });
  }

  public compareBranchWithUserSchema(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    schema: Schemas.Schema
  ): Promise<Responses.SchemaCompareResponse> {
    return operationsByTag.migrations.compareBranchWithUserSchema({
      pathParams: { workspace, dbBranchName: `${database}:${branch}` },
      body: { schema },
      ...this.extraProps
    });
  }

  public compareBranchSchemas(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    branchName: Schemas.BranchName,
    schema: Schemas.Schema
  ): Promise<Responses.SchemaCompareResponse> {
    return operationsByTag.migrations.compareBranchSchemas({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, branchName },
      body: { schema },
      ...this.extraProps
    });
  }

  public updateBranchSchema(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    migration: Schemas.Migration
  ): Promise<Components.UpdateBranchSchemaResponse> {
    return operationsByTag.migrations.updateBranchSchema({
      pathParams: { workspace, dbBranchName: `${database}:${branch}` },
      body: migration,
      ...this.extraProps
    });
  }

  public previewBranchSchemaEdit(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    migration: Schemas.Migration
  ): Promise<Components.PreviewBranchSchemaEditResponse> {
    return operationsByTag.migrations.previewBranchSchemaEdit({
      pathParams: { workspace, dbBranchName: `${database}:${branch}` },
      body: migration,
      ...this.extraProps
    });
  }

  public applyBranchSchemaEdit(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    edits: Schemas.SchemaEditScript
  ): Promise<Components.ApplyBranchSchemaEditResponse> {
    return operationsByTag.migrations.applyBranchSchemaEdit({
      pathParams: { workspace, dbBranchName: `${database}:${branch}` },
      body: { edits },
      ...this.extraProps
    });
  }
}
class DatabasesApi {
  constructor(private extraProps: FetcherExtraProps) {}

  /**
  * 
  *  cPGetDatabaseList,
    cPCreateDatabase,
    cPDeleteDatabase,
    cPGetCPDatabaseMetadata,
    cPUpdateCPDatabaseMetadata,
    listRegions
  */

  public getDatabaseList(workspaceId: Schemas.WorkspaceID): Promise<Schemas.CPListDatabasesResponse> {
    return operationsByTag.databases.cPGetDatabaseList({
      pathParams: { workspaceId },
      ...this.extraProps
    });
  }

  public createDatabase(
    workspaceId: Schemas.WorkspaceID,
    dbName: Schemas.DBName,
    options: Components.CPCreateDatabaseRequestBody
  ): Promise<Components.CPCreateDatabaseResponse> {
    return operationsByTag.databases.cPCreateDatabase({
      pathParams: { workspaceId, dbName },
      body: options,
      ...this.extraProps
    });
  }

  public deleteDatabase(workspaceId: Schemas.WorkspaceID, dbName: Schemas.DBName): Promise<void> {
    return operationsByTag.databases.cPDeleteDatabase({
      pathParams: { workspaceId, dbName },
      ...this.extraProps
    });
  }

  public getDatabaseMetadata(
    workspaceId: Schemas.WorkspaceID,
    dbName: Schemas.DBName
  ): Promise<Schemas.CPDatabaseMetadata> {
    return operationsByTag.databases.cPGetCPDatabaseMetadata({
      pathParams: { workspaceId, dbName },
      ...this.extraProps
    });
  }

  public updateDatabaseMetadata(
    workspaceId: Schemas.WorkspaceID,
    dbName: Schemas.DBName,
    metadata: Schemas.CPDatabaseMetadata
  ): Promise<Schemas.CPDatabaseMetadata> {
    return operationsByTag.databases.cPUpdateCPDatabaseMetadata({
      pathParams: { workspaceId, dbName },
      body: metadata,
      ...this.extraProps
    });
  }

  public listRegions(workspaceId: Schemas.WorkspaceID): Promise<Schemas.ListRegionsResponse> {
    return operationsByTag.databases.listRegions({
      pathParams: { workspaceId },
      ...this.extraProps
    });
  }
}
