import { getAPIKey } from '../util/apiKey';
import { getFetchImplementation } from '../util/fetch';
import { isString } from '../util/lang';
import type * as Types from './components';
import { operationsByTag } from './components';
import type { FetcherExtraProps, FetchImpl } from './fetcher';
import { HostProvider, getHostUrl } from './providers';
import type * as Responses from './responses';
import type * as Schemas from './schemas';

export interface XataApiClientOptions {
  fetch?: FetchImpl;
  apiKey?: string;
  host?: HostProvider;
}

/**
 * @deprecated Use XataApiPlugin instead
 */
export class XataApiClient {
  #extraProps: FetcherExtraProps;
  #namespaces: Partial<{
    user: UserApi;
    workspaces: WorkspaceApi;
    databases: DatabaseApi;
    branches: BranchApi;
    tables: TableApi;
    records: RecordsApi;
  }> = {};

  constructor(options: XataApiClientOptions = {}) {
    const provider = options.host ?? 'production';
    const apiKey = options?.apiKey ?? getAPIKey();

    if (!apiKey) {
      throw new Error('Could not resolve a valid apiKey');
    }

    this.#extraProps = {
      apiUrl: getHostUrl(provider, 'main'),
      workspacesApiUrl: getHostUrl(provider, 'workspaces'),
      fetchImpl: getFetchImplementation(options.fetch),
      apiKey
    };
  }

  public get user() {
    if (!this.#namespaces.user) this.#namespaces.user = new UserApi(this.#extraProps);
    return this.#namespaces.user;
  }

  public get workspaces() {
    if (!this.#namespaces.workspaces) this.#namespaces.workspaces = new WorkspaceApi(this.#extraProps);
    return this.#namespaces.workspaces;
  }

  public get databases() {
    if (!this.#namespaces.databases) this.#namespaces.databases = new DatabaseApi(this.#extraProps);
    return this.#namespaces.databases;
  }

  public get branches() {
    if (!this.#namespaces.branches) this.#namespaces.branches = new BranchApi(this.#extraProps);
    return this.#namespaces.branches;
  }

  public get tables() {
    if (!this.#namespaces.tables) this.#namespaces.tables = new TableApi(this.#extraProps);
    return this.#namespaces.tables;
  }

  public get records() {
    if (!this.#namespaces.records) this.#namespaces.records = new RecordsApi(this.#extraProps);
    return this.#namespaces.records;
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

  public getUserAPIKeys(): Promise<Types.GetUserAPIKeysResponse> {
    return operationsByTag.users.getUserAPIKeys({ ...this.extraProps });
  }

  public createUserAPIKey(keyName: Schemas.APIKeyName): Promise<Types.CreateUserAPIKeyResponse> {
    return operationsByTag.users.createUserAPIKey({
      pathParams: { keyName },
      ...this.extraProps
    });
  }

  public deleteUserAPIKey(keyName: Schemas.APIKeyName): Promise<void> {
    return operationsByTag.users.deleteUserAPIKey({
      pathParams: { keyName },
      ...this.extraProps
    });
  }
}

class WorkspaceApi {
  constructor(private extraProps: FetcherExtraProps) {}

  public createWorkspace(workspaceMeta: Schemas.WorkspaceMeta): Promise<Schemas.Workspace> {
    return operationsByTag.workspaces.createWorkspace({
      body: workspaceMeta,
      ...this.extraProps
    });
  }

  public getWorkspacesList(): Promise<Types.GetWorkspacesListResponse> {
    return operationsByTag.workspaces.getWorkspacesList({ ...this.extraProps });
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

  public inviteWorkspaceMember(
    workspaceId: Schemas.WorkspaceID,
    email: string,
    role: Schemas.Role
  ): Promise<Schemas.WorkspaceInvite> {
    return operationsByTag.workspaces.inviteWorkspaceMember({
      pathParams: { workspaceId },
      body: { email, role },
      ...this.extraProps
    });
  }

  public cancelWorkspaceMemberInvite(workspaceId: Schemas.WorkspaceID, inviteId: Schemas.InviteID): Promise<void> {
    return operationsByTag.workspaces.cancelWorkspaceMemberInvite({
      pathParams: { workspaceId, inviteId },
      ...this.extraProps
    });
  }

  public resendWorkspaceMemberInvite(workspaceId: Schemas.WorkspaceID, inviteId: Schemas.InviteID): Promise<void> {
    return operationsByTag.workspaces.resendWorkspaceMemberInvite({
      pathParams: { workspaceId, inviteId },
      ...this.extraProps
    });
  }

  public acceptWorkspaceMemberInvite(workspaceId: Schemas.WorkspaceID, inviteKey: Schemas.InviteKey): Promise<void> {
    return operationsByTag.workspaces.acceptWorkspaceMemberInvite({
      pathParams: { workspaceId, inviteKey },
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

  public getGitBranchesMapping(
    workspace: Schemas.WorkspaceID,
    dbName: Schemas.DBName
  ): Promise<Schemas.ListGitBranchesResponse> {
    return operationsByTag.database.getGitBranchesMapping({
      pathParams: { workspace, dbName },
      ...this.extraProps
    });
  }

  public addGitBranchesEntry(
    workspace: Schemas.WorkspaceID,
    dbName: Schemas.DBName,
    body: Types.AddGitBranchesEntryRequestBody
  ): Promise<Types.AddGitBranchesEntryResponse> {
    return operationsByTag.database.addGitBranchesEntry({
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
    return operationsByTag.database.removeGitBranchesEntry({
      pathParams: { workspace, dbName },
      queryParams: { gitBranch },
      ...this.extraProps
    });
  }

  public resolveBranch(
    workspace: Schemas.WorkspaceID,
    dbName: Schemas.DBName,
    gitBranch: string
  ): Promise<Types.ResolveBranchResponse> {
    return operationsByTag.database.resolveBranch({
      pathParams: { workspace, dbName },
      queryParams: { gitBranch },
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
  ): Promise<void> {
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

  public getBranchMigrationHistory(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    options: Types.GetBranchMigrationHistoryRequestBody = {}
  ): Promise<Types.GetBranchMigrationHistoryResponse> {
    return operationsByTag.branch.getBranchMigrationHistory({
      pathParams: { workspace, dbBranchName: `${database}:${branch}` },
      body: options,
      ...this.extraProps
    });
  }

  public executeBranchMigrationPlan(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    migrationPlan: Types.ExecuteBranchMigrationPlanRequestBody
  ): Promise<void> {
    return operationsByTag.branch.executeBranchMigrationPlan({
      pathParams: { workspace, dbBranchName: `${database}:${branch}` },
      body: migrationPlan,
      ...this.extraProps
    });
  }

  public getBranchMigrationPlan(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    schema: Schemas.Schema
  ): Promise<Responses.BranchMigrationPlan> {
    return operationsByTag.branch.getBranchMigrationPlan({
      pathParams: { workspace, dbBranchName: `${database}:${branch}` },
      body: schema,
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
}

class TableApi {
  constructor(private extraProps: FetcherExtraProps) {}

  public createTable(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName
  ): Promise<void> {
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
}

class RecordsApi {
  constructor(private extraProps: FetcherExtraProps) {}

  public insertRecord(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    record: Record<string, any>
  ): Promise<Types.InsertRecordResponse> {
    return operationsByTag.records.insertRecord({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName },
      body: record,
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
    recordId: Schemas.RecordID
  ): Promise<void> {
    return operationsByTag.records.deleteRecord({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName, recordId },
      ...this.extraProps
    });
  }

  public getRecord(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    recordId: Schemas.RecordID,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options: Types.GetRecordRequestBody = {}
  ): Promise<Schemas.XataRecord> {
    return operationsByTag.records.getRecord({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName, recordId },
      // TODO: FIXME https://github.com/xataio/openapi/issues/139
      //body: options,
      ...this.extraProps
    });
  }

  public bulkInsertTableRecords(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    records: Record<string, any>[]
  ): Promise<Types.BulkInsertTableRecordsResponse> {
    return operationsByTag.records.bulkInsertTableRecords({
      pathParams: { workspace, dbBranchName: `${database}:${branch}`, tableName },
      body: { records },
      ...this.extraProps
    });
  }

  public queryTable(
    workspace: Schemas.WorkspaceID,
    database: Schemas.DBName,
    branch: Schemas.BranchName,
    tableName: Schemas.TableName,
    query: Types.QueryTableRequestBody
  ): Promise<Responses.QueryResponse> {
    return operationsByTag.records.queryTable({
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
    return operationsByTag.records.searchBranch({
      pathParams: { workspace, dbBranchName: `${database}:${branch}` },
      body: query,
      ...this.extraProps
    });
  }
}
