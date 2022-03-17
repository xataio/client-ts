import { BaseClient, Repository } from '..';
import { errors } from '../util/errors';
import type * as Types from './xatabaseComponents';
import { operationsByTag } from './xatabaseComponents';
import type { FetchImpl } from './xatabaseFetcher';
import type * as Responses from './xatabaseResponses';
import type * as Schemas from './xatabaseSchemas';

export class XataApi<D extends Record<string, Repository<any>>> {
  private fetchImpl: FetchImpl;

  constructor(private client: BaseClient<D>) {
    const doWeHaveFetch = typeof fetch !== 'undefined';
    const isInjectedFetchProblematic = !this.client.options.fetch;

    if (doWeHaveFetch) {
      this.fetchImpl = fetch;
    } else if (isInjectedFetchProblematic) {
      throw new Error(errors.falsyFetchImplementation);
    } else if (this.client.options.fetch) {
      this.fetchImpl = this.client.options.fetch;
    } else {
      throw new Error(errors.noFetchImplementation);
    }
  }

  public get user() {
    return new UserApi<D>(this.client, this.fetchImpl);
  }

  public get workspace() {
    return new WorkspaceApi<D>(this.client, this.fetchImpl);
  }

  public get database() {
    return new DatabaseApi<D>(this.client, this.fetchImpl);
  }

  public get branch() {
    return new BranchApi<D>(this.client, this.fetchImpl);
  }

  public get table() {
    return new TableApi<D>(this.client, this.fetchImpl);
  }

  public get records() {
    return new RecordsApi<D>(this.client, this.fetchImpl);
  }
}

class UserApi<D extends Record<string, Repository<any>>> {
  constructor(private client: BaseClient<D>, private fetchImpl: FetchImpl) {}

  public getUser(): Promise<Schemas.UserWithID> {
    return operationsByTag.users.getUser({ fetchImpl: this.fetchImpl });
  }

  public updateUser(user: Schemas.User): Promise<Schemas.UserWithID> {
    return operationsByTag.users.updateUser({ body: user, fetchImpl: this.fetchImpl });
  }

  public deleteUser(): Promise<void> {
    return operationsByTag.users.deleteUser({ fetchImpl: this.fetchImpl });
  }

  public getUserAPIKeys(): Promise<Types.GetUserAPIKeysResponse> {
    return operationsByTag.users.getUserAPIKeys({ fetchImpl: this.fetchImpl });
  }

  public createUserAPIKey(keyName: Schemas.APIKeyName): Promise<Types.CreateUserAPIKeyResponse> {
    return operationsByTag.users.createUserAPIKey({ pathParams: { keyName }, fetchImpl: this.fetchImpl });
  }

  public deleteUserAPIKey(keyName: Schemas.APIKeyName): Promise<void> {
    return operationsByTag.users.deleteUserAPIKey({ pathParams: { keyName }, fetchImpl: this.fetchImpl });
  }
}

class WorkspaceApi<D extends Record<string, Repository<any>>> {
  constructor(private client: BaseClient<D>, private fetchImpl: FetchImpl) {}

  public createWorkspace(workspaceMeta: Schemas.WorkspaceMeta): Promise<Schemas.Workspace> {
    return operationsByTag.workspaces.createWorkspace({ body: workspaceMeta, fetchImpl: this.fetchImpl });
  }

  public getWorkspacesList(): Promise<Types.GetWorkspacesListResponse> {
    return operationsByTag.workspaces.getWorkspacesList({ fetchImpl: this.fetchImpl });
  }

  public getWorkspace(workspaceId: Schemas.WorkspaceID): Promise<Schemas.Workspace> {
    return operationsByTag.workspaces.getWorkspace({ pathParams: { workspaceId }, fetchImpl: this.fetchImpl });
  }

  public updateWorkspace(
    workspaceId: Schemas.WorkspaceID,
    workspaceMeta: Schemas.WorkspaceMeta
  ): Promise<Schemas.Workspace> {
    return operationsByTag.workspaces.updateWorkspace({
      pathParams: { workspaceId },
      body: workspaceMeta,
      fetchImpl: this.fetchImpl
    });
  }

  public deleteWorkspace(workspaceId: Schemas.WorkspaceID): Promise<void> {
    return operationsByTag.workspaces.deleteWorkspace({ pathParams: { workspaceId }, fetchImpl: this.fetchImpl });
  }

  public getWorkspaceMembersList(workspaceId: Schemas.WorkspaceID): Promise<Schemas.WorkspaceMembers> {
    return operationsByTag.workspaces.getWorkspaceMembersList({
      pathParams: { workspaceId },
      fetchImpl: this.fetchImpl
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
      fetchImpl: this.fetchImpl
    });
  }

  public removeWorkspaceMember(workspaceId: Schemas.WorkspaceID, userId: Schemas.UserID): Promise<void> {
    return operationsByTag.workspaces.removeWorkspaceMember({
      pathParams: { workspaceId, userId },
      fetchImpl: this.fetchImpl
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
      fetchImpl: this.fetchImpl
    });
  }

  public acceptWorkspaceMemberInvite(workspaceId: Schemas.WorkspaceID, inviteKey: Schemas.InviteKey): Promise<void> {
    return operationsByTag.workspaces.acceptWorkspaceMemberInvite({
      pathParams: { workspaceId, inviteKey },
      fetchImpl: this.fetchImpl
    });
  }
}

class DatabaseApi<D extends Record<string, Repository<any>>> {
  constructor(private client: BaseClient<D>, private fetchImpl: FetchImpl) {}

  public getDatabaseList(workspace: Schemas.WorkspaceID): Promise<Schemas.ListDatabasesResponse> {
    return operationsByTag.database.getDatabaseList({
      pathParams: { workspace },
      fetchImpl: this.fetchImpl
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
      fetchImpl: this.fetchImpl
    });
  }

  public deleteDatabase(workspace: Schemas.WorkspaceID, dbName: Schemas.DBName): Promise<void> {
    return operationsByTag.database.deleteDatabase({
      pathParams: { workspace, dbName },
      fetchImpl: this.fetchImpl
    });
  }
}

class BranchApi<D extends Record<string, Repository<any>>> {
  constructor(private client: BaseClient<D>, private fetchImpl: FetchImpl) {}

  public getBranchList(workspace: Schemas.WorkspaceID, dbName: Schemas.DBName): Promise<Schemas.ListBranchesResponse> {
    return operationsByTag.branch.getBranchList({
      pathParams: { workspace, dbName },
      fetchImpl: this.fetchImpl
    });
  }

  public getBranchDetails(workspace: Schemas.WorkspaceID, dbBranchName: Schemas.BranchName): Promise<Schemas.DBBranch> {
    return operationsByTag.branch.getBranchDetails({
      pathParams: { workspace, dbBranchName },
      fetchImpl: this.fetchImpl
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
      fetchImpl: this.fetchImpl
    });
  }

  public deleteBranch(workspace: Schemas.WorkspaceID, dbBranchName: Schemas.DBBranchName): Promise<void> {
    return operationsByTag.branch.deleteBranch({
      pathParams: { workspace, dbBranchName },
      fetchImpl: this.fetchImpl
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
      fetchImpl: this.fetchImpl
    });
  }

  public getBranchMetadata(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBBranchName
  ): Promise<Schemas.BranchMetadata> {
    return operationsByTag.branch.getBranchMetadata({
      pathParams: { workspace, dbBranchName },
      fetchImpl: this.fetchImpl
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
      fetchImpl: this.fetchImpl
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
      fetchImpl: this.fetchImpl
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
      fetchImpl: this.fetchImpl
    });
  }

  public getBranchStats(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBBranchName
  ): Promise<Types.GetBranchStatsResponse> {
    return operationsByTag.branch.getBranchStats({
      pathParams: { workspace, dbBranchName },
      fetchImpl: this.fetchImpl
    });
  }
}

class TableApi<D extends Record<string, Repository<any>>> {
  constructor(private client: BaseClient<D>, private fetchImpl: FetchImpl) {}

  public createTable(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBName,
    tableName: Schemas.TableName
  ): Promise<void> {
    return operationsByTag.table.createTable({
      pathParams: { workspace, dbBranchName, tableName },
      fetchImpl: this.fetchImpl
    });
  }

  public deleteTable(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBName,
    tableName: Schemas.TableName
  ): Promise<void> {
    return operationsByTag.table.deleteTable({
      pathParams: { workspace, dbBranchName, tableName },
      fetchImpl: this.fetchImpl
    });
  }

  public updateTable(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBName,
    tableName: Schemas.TableName,
    options: Types.UpdateTableRequestBody
  ): Promise<void> {
    return operationsByTag.table.updateTable({
      pathParams: { workspace, dbBranchName, tableName },
      body: options,
      fetchImpl: this.fetchImpl
    });
  }

  public getTableSchema(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBName,
    tableName: Schemas.TableName
  ): Promise<Types.GetTableSchemaResponse> {
    return operationsByTag.table.getTableSchema({
      pathParams: { workspace, dbBranchName, tableName },
      fetchImpl: this.fetchImpl
    });
  }

  public setTableSchema(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBName,
    tableName: Schemas.TableName,
    options: Types.SetTableSchemaRequestBody
  ): Promise<void> {
    return operationsByTag.table.setTableSchema({
      pathParams: { workspace, dbBranchName, tableName },
      body: options,
      fetchImpl: this.fetchImpl
    });
  }

  public getTableColumns(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBName,
    tableName: Schemas.TableName
  ): Promise<Types.GetTableColumnsResponse> {
    return operationsByTag.table.getTableColumns({
      pathParams: { workspace, dbBranchName, tableName },
      fetchImpl: this.fetchImpl
    });
  }

  public addTableColumn(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBName,
    tableName: Schemas.TableName,
    column: Schemas.Column
  ): Promise<Responses.MigrationIdResponse> {
    return operationsByTag.table.addTableColumn({
      pathParams: { workspace, dbBranchName, tableName },
      body: column,
      fetchImpl: this.fetchImpl
    });
  }

  public getColumn(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBName,
    tableName: Schemas.TableName,
    columnName: Schemas.ColumnName
  ): Promise<Schemas.Column> {
    return operationsByTag.table.getColumn({
      pathParams: { workspace, dbBranchName, tableName, columnName },
      fetchImpl: this.fetchImpl
    });
  }

  public deleteColumn(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBName,
    tableName: Schemas.TableName,
    columnName: Schemas.ColumnName
  ): Promise<Responses.MigrationIdResponse> {
    return operationsByTag.table.deleteColumn({
      pathParams: { workspace, dbBranchName, tableName, columnName },
      fetchImpl: this.fetchImpl
    });
  }

  public updateColumn(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBName,
    tableName: Schemas.TableName,
    columnName: Schemas.ColumnName,
    options: Types.UpdateColumnRequestBody
  ): Promise<Responses.MigrationIdResponse> {
    return operationsByTag.table.updateColumn({
      pathParams: { workspace, dbBranchName, tableName, columnName },
      body: options,
      fetchImpl: this.fetchImpl
    });
  }
}

class RecordsApi<D extends Record<string, Repository<any>>> {
  constructor(private client: BaseClient<D>, private fetchImpl: FetchImpl) {}

  public insertRecord(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBName,
    tableName: Schemas.TableName,
    record: Record<string, any>
  ): Promise<Types.InsertRecordResponse> {
    return operationsByTag.records.insertRecord({
      pathParams: { workspace, dbBranchName, tableName },
      body: record,
      fetchImpl: this.fetchImpl
    });
  }

  public insertRecordWithID(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBName,
    tableName: Schemas.TableName,
    recordId: Schemas.RecordID,
    record: Record<string, any>,
    options: Types.InsertRecordWithIDQueryParams = {}
  ): Promise<Types.InsertRecordWithIDResponse> {
    return operationsByTag.records.insertRecordWithID({
      pathParams: { workspace, dbBranchName, tableName, recordId },
      queryParams: options,
      body: record,
      fetchImpl: this.fetchImpl
    });
  }

  public deleteRecord(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBName,
    tableName: Schemas.TableName,
    recordId: Schemas.RecordID
  ): Promise<void> {
    return operationsByTag.records.deleteRecord({
      pathParams: { workspace, dbBranchName, tableName, recordId },
      fetchImpl: this.fetchImpl
    });
  }

  public getRecord(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBName,
    tableName: Schemas.TableName,
    recordId: Schemas.RecordID,
    options: Types.GetRecordRequestBody = {}
  ): Promise<Schemas.XataRecord> {
    return operationsByTag.records.getRecord({
      pathParams: { workspace, dbBranchName, tableName, recordId },
      body: options,
      fetchImpl: this.fetchImpl
    });
  }

  public bulkInsertTableRecords(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBName,
    tableName: Schemas.TableName,
    records: Record<string, any>[]
  ): Promise<Types.BulkInsertTableRecordsResponse> {
    return operationsByTag.records.bulkInsertTableRecords({
      pathParams: { workspace, dbBranchName, tableName },
      body: { records },
      fetchImpl: this.fetchImpl
    });
  }

  public queryTable(
    workspace: Schemas.WorkspaceID,
    dbBranchName: Schemas.DBName,
    tableName: Schemas.TableName,
    query: Types.QueryTableRequestBody
  ): Promise<Responses.QueryResponse> {
    return operationsByTag.records.queryTable({
      pathParams: { workspace, dbBranchName, tableName },
      body: query,
      fetchImpl: this.fetchImpl
    });
  }
}
