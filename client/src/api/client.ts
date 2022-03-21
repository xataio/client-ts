import { errors } from '../util/errors';
import type * as Types from './components';
import { operationsByTag } from './components';
import type { FetcherExtraProps, FetchImpl } from './fetcher';
import { HostProvider, getHostUrl } from './providers';
import type * as Responses from './responses';
import type * as Schemas from './schemas';

export interface XataApiClientOptions {
  fetchImpl: FetchImpl;
  apiKey: string;
  host?: HostProvider;
}

export class XataApiClient {
  private extraProps: FetcherExtraProps;

  constructor(options: XataApiClientOptions) {
    const fetchImpl = typeof fetch !== 'undefined' ? fetch : options.fetchImpl;
    if (!fetchImpl) {
      throw new Error(errors.noFetchImplementation);
    }

    const provider = options.host ?? 'production';

    this.extraProps = {
      apiUrl: getHostUrl(provider, 'main'),
      workspacesApiUrl: getHostUrl(provider, 'workspaces'),
      fetchImpl,
      apiKey: options.apiKey
    };
  }

  public get user() {
    return new UserApi(this.extraProps);
  }

  public get workspace() {
    return new WorkspaceApi(this.extraProps);
  }

  public get database() {
    return new DatabaseApi(this.extraProps);
  }

  public get branch() {
    return new BranchApi(this.extraProps);
  }

  public get table() {
    return new TableApi(this.extraProps);
  }

  public get records() {
    return new RecordsApi(this.extraProps);
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
}

class BranchApi {
  constructor(private extraProps: FetcherExtraProps) {}

  public getBranchList(workspace: Schemas.WorkspaceID, dbName: Schemas.DBName): Promise<Schemas.ListBranchesResponse> {
    return operationsByTag.branch.getBranchList({
      pathParams: { workspace, dbName },
      ...this.extraProps
    });
  }

  public getBranchDetails(workspace: Schemas.WorkspaceID, dbBranchName: Schemas.BranchName): Promise<Schemas.DBBranch> {
    return operationsByTag.branch.getBranchDetails({
      pathParams: { workspace, dbBranchName },
      ...this.extraProps
    });
  }

  public createBranch(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBBranchName,
    from?: string,
    options: Types.CreateBranchRequestBody = {}
  ): Promise<undefined> {
    return operationsByTag.branch.createBranch({
      pathParams: { workspace, dbBranchName },
      queryParams: { from },
      body: options,
      ...this.extraProps
    });
  }

  public deleteBranch(workspace: Schemas.WorkspaceID, dbBranchName: Schemas.DBBranchName): Promise<void> {
    return operationsByTag.branch.deleteBranch({
      pathParams: { workspace, dbBranchName },
      ...this.extraProps
    });
  }

  public updateBranchMetadata(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBBranchName,
    metadata: Schemas.BranchMetadata = {}
  ): Promise<void> {
    return operationsByTag.branch.updateBranchMetadata({
      pathParams: { workspace, dbBranchName },
      body: metadata,
      ...this.extraProps
    });
  }

  public getBranchMetadata(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBBranchName
  ): Promise<Schemas.BranchMetadata> {
    return operationsByTag.branch.getBranchMetadata({
      pathParams: { workspace, dbBranchName },
      ...this.extraProps
    });
  }

  public getBranchMigrationHistory(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBBranchName,
    options: Types.GetBranchMigrationHistoryRequestBody = {}
  ): Promise<Types.GetBranchMigrationHistoryResponse> {
    return operationsByTag.branch.getBranchMigrationHistory({
      pathParams: { workspace, dbBranchName },
      body: options,
      ...this.extraProps
    });
  }

  public executeBranchMigrationPlan(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBBranchName,
    migrationPlan: Types.ExecuteBranchMigrationPlanRequestBody
  ): Promise<void> {
    return operationsByTag.branch.executeBranchMigrationPlan({
      pathParams: { workspace, dbBranchName },
      body: migrationPlan,
      ...this.extraProps
    });
  }

  public getBranchMigrationPlan(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBBranchName,
    schema: Schemas.Schema
  ): Promise<Responses.BranchMigrationPlan> {
    return operationsByTag.branch.getBranchMigrationPlan({
      pathParams: { workspace, dbBranchName },
      body: schema,
      ...this.extraProps
    });
  }

  public getBranchStats(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBBranchName
  ): Promise<Types.GetBranchStatsResponse> {
    return operationsByTag.branch.getBranchStats({
      pathParams: { workspace, dbBranchName },
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
  ): Promise<Types.InsertRecordWithIDResponse> {
    return operationsByTag.records.insertRecordWithID({
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
}
