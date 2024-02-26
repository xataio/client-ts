import { defaultTrace, TraceFunction } from '../schema/tracing';
import { getAPIKey } from '../util/environment';
import { FetchImpl, getFetchImplementation } from '../util/fetch';
import { generateUUID } from '../util/uuid';
import type * as Components from './components';
import type * as Types from './components';
import { operationsByTag } from './components';
import type { FetcherExtraProps } from './fetcher';
import { getHostUrl, HostProvider } from './providers';
import type * as Responses from './responses';
import type * as Schemas from './schemas';

export type ApiExtraProps = Omit<FetcherExtraProps, 'endpoint'>;

export interface XataApiClientOptions {
  fetch?: FetchImpl;
  apiKey?: string;
  host?: HostProvider;
  trace?: TraceFunction;
  clientName?: string;
  xataAgentExtra?: Record<string, string>;
}

export class XataApiClient {
  #extraProps: ApiExtraProps;
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
    files: FilesApi;
    searchAndFilter: SearchAndFilterApi;
  }> = {};

  constructor(options: XataApiClientOptions = {}) {
    const provider = options.host ?? 'production';
    const apiKey = options.apiKey ?? getAPIKey();
    const trace = options.trace ?? defaultTrace;
    const clientID = generateUUID();

    if (!apiKey) {
      throw new Error('Could not resolve a valid apiKey');
    }

    this.#extraProps = {
      apiUrl: getHostUrl(provider, 'main'),
      workspacesApiUrl: getHostUrl(provider, 'workspaces'),
      fetch: getFetchImplementation(options.fetch),
      apiKey,
      trace,
      clientName: options.clientName,
      xataAgentExtra: options.xataAgentExtra,
      clientID
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

  public get files() {
    if (!this.#namespaces.files) this.#namespaces.files = new FilesApi(this.#extraProps);
    return this.#namespaces.files;
  }

  public get searchAndFilter() {
    if (!this.#namespaces.searchAndFilter) this.#namespaces.searchAndFilter = new SearchAndFilterApi(this.#extraProps);
    return this.#namespaces.searchAndFilter;
  }
}

class UserApi {
  constructor(private extraProps: ApiExtraProps) {}

  public getUser(): Promise<Schemas.UserWithID> {
    return operationsByTag.users.getUser({ ...this.extraProps });
  }

  public updateUser({ user }: { user: Schemas.User }): Promise<Schemas.UserWithID> {
    return operationsByTag.users.updateUser({ body: user, ...this.extraProps });
  }

  public deleteUser(): Promise<void> {
    return operationsByTag.users.deleteUser({ ...this.extraProps });
  }
}

class AuthenticationApi {
  constructor(private extraProps: ApiExtraProps) {}

  public getUserAPIKeys(): Promise<Types.GetUserAPIKeysResponse> {
    return operationsByTag.authentication.getUserAPIKeys({ ...this.extraProps });
  }

  public createUserAPIKey({ name }: { name: Schemas.APIKeyName }): Promise<Types.CreateUserAPIKeyResponse> {
    return operationsByTag.authentication.createUserAPIKey({
      pathParams: { keyName: name },
      ...this.extraProps
    });
  }

  public deleteUserAPIKey({ name }: { name: Schemas.APIKeyName }): Promise<void> {
    return operationsByTag.authentication.deleteUserAPIKey({
      pathParams: { keyName: name },
      ...this.extraProps
    });
  }
}

class WorkspaceApi {
  constructor(private extraProps: ApiExtraProps) {}

  public getWorkspacesList(): Promise<Types.GetWorkspacesListResponse> {
    return operationsByTag.workspaces.getWorkspacesList({ ...this.extraProps });
  }

  public createWorkspace({ data }: { data: Schemas.WorkspaceMeta }): Promise<Schemas.Workspace> {
    return operationsByTag.workspaces.createWorkspace({
      body: data,
      ...this.extraProps
    });
  }

  public getWorkspace({ workspace }: { workspace: Schemas.WorkspaceID }): Promise<Schemas.Workspace> {
    return operationsByTag.workspaces.getWorkspace({
      pathParams: { workspaceId: workspace },
      ...this.extraProps
    });
  }

  public updateWorkspace({
    workspace,
    update
  }: {
    workspace: Schemas.WorkspaceID;
    update: Schemas.WorkspaceMeta;
  }): Promise<Schemas.Workspace> {
    return operationsByTag.workspaces.updateWorkspace({
      pathParams: { workspaceId: workspace },
      body: update,
      ...this.extraProps
    });
  }

  public deleteWorkspace({ workspace }: { workspace: Schemas.WorkspaceID }): Promise<void> {
    return operationsByTag.workspaces.deleteWorkspace({
      pathParams: { workspaceId: workspace },
      ...this.extraProps
    });
  }

  public getWorkspaceMembersList({ workspace }: { workspace: Schemas.WorkspaceID }): Promise<Schemas.WorkspaceMembers> {
    return operationsByTag.workspaces.getWorkspaceMembersList({
      pathParams: { workspaceId: workspace },
      ...this.extraProps
    });
  }

  public updateWorkspaceMemberRole({
    workspace,
    user,
    role
  }: {
    workspace: Schemas.WorkspaceID;
    user: Schemas.UserID;
    role: Schemas.Role;
  }): Promise<void> {
    return operationsByTag.workspaces.updateWorkspaceMemberRole({
      pathParams: { workspaceId: workspace, userId: user },
      body: { role },
      ...this.extraProps
    });
  }

  public removeWorkspaceMember({
    workspace,
    user
  }: {
    workspace: Schemas.WorkspaceID;
    user: Schemas.UserID;
  }): Promise<void> {
    return operationsByTag.workspaces.removeWorkspaceMember({
      pathParams: { workspaceId: workspace, userId: user },
      ...this.extraProps
    });
  }
}

class InvitesApi {
  constructor(private extraProps: ApiExtraProps) {}

  public inviteWorkspaceMember({
    workspace,
    email,
    role
  }: {
    workspace: Schemas.WorkspaceID;
    email: string;
    role: Schemas.Role;
  }): Promise<Schemas.WorkspaceInvite> {
    return operationsByTag.invites.inviteWorkspaceMember({
      pathParams: { workspaceId: workspace },
      body: { email, role },
      ...this.extraProps
    });
  }

  public updateWorkspaceMemberInvite({
    workspace,
    invite,
    role
  }: {
    workspace: Schemas.WorkspaceID;
    invite: Schemas.InviteID;
    role: Schemas.Role;
  }): Promise<Schemas.WorkspaceInvite> {
    return operationsByTag.invites.updateWorkspaceMemberInvite({
      pathParams: { workspaceId: workspace, inviteId: invite },
      body: { role },
      ...this.extraProps
    });
  }

  public cancelWorkspaceMemberInvite({
    workspace,
    invite
  }: {
    workspace: Schemas.WorkspaceID;
    invite: Schemas.InviteID;
  }): Promise<void> {
    return operationsByTag.invites.cancelWorkspaceMemberInvite({
      pathParams: { workspaceId: workspace, inviteId: invite },
      ...this.extraProps
    });
  }

  public acceptWorkspaceMemberInvite({
    workspace,
    key
  }: {
    workspace: Schemas.WorkspaceID;
    key: Schemas.InviteKey;
  }): Promise<void> {
    return operationsByTag.invites.acceptWorkspaceMemberInvite({
      pathParams: { workspaceId: workspace, inviteKey: key },
      ...this.extraProps
    });
  }

  public resendWorkspaceMemberInvite({
    workspace,
    invite
  }: {
    workspace: Schemas.WorkspaceID;
    invite: Schemas.InviteID;
  }): Promise<void> {
    return operationsByTag.invites.resendWorkspaceMemberInvite({
      pathParams: { workspaceId: workspace, inviteId: invite },
      ...this.extraProps
    });
  }
}

class BranchApi {
  constructor(private extraProps: ApiExtraProps) {}

  public getBranchList({
    workspace,
    region,
    database
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
  }): Promise<Schemas.ListBranchesResponse> {
    return operationsByTag.branch.getBranchList({
      pathParams: { workspace, region, dbName: database },
      ...this.extraProps
    });
  }

  public getBranchDetails({
    workspace,
    region,
    database,
    branch
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
  }): Promise<Schemas.DBBranch> {
    return operationsByTag.branch.getBranchDetails({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      ...this.extraProps
    });
  }

  public createBranch({
    workspace,
    region,
    database,
    branch,
    from,
    metadata
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    from?: string;
    metadata?: Schemas.BranchMetadata;
  }): Promise<Types.CreateBranchResponse> {
    return operationsByTag.branch.createBranch({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      body: { from, metadata },
      ...this.extraProps
    });
  }

  public deleteBranch({
    workspace,
    region,
    database,
    branch
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
  }): Promise<Components.DeleteBranchResponse> {
    return operationsByTag.branch.deleteBranch({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      ...this.extraProps
    });
  }

  public copyBranch({
    workspace,
    region,
    database,
    branch,
    destinationBranch,
    limit
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    destinationBranch: Schemas.BranchName;
    limit?: number;
  }): Promise<Schemas.BranchWithCopyID> {
    return operationsByTag.branch.copyBranch({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      body: { destinationBranch, limit },
      ...this.extraProps
    });
  }

  public updateBranchMetadata({
    workspace,
    region,
    database,
    branch,
    metadata
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    metadata: Schemas.BranchMetadata;
  }): Promise<void> {
    return operationsByTag.branch.updateBranchMetadata({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      body: metadata,
      ...this.extraProps
    });
  }

  public getBranchMetadata({
    workspace,
    region,
    database,
    branch
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
  }): Promise<Schemas.BranchMetadata> {
    return operationsByTag.branch.getBranchMetadata({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      ...this.extraProps
    });
  }

  public getBranchStats({
    workspace,
    region,
    database,
    branch
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
  }): Promise<Types.GetBranchStatsResponse> {
    return operationsByTag.branch.getBranchStats({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      ...this.extraProps
    });
  }

  public getGitBranchesMapping({
    workspace,
    region,
    database
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
  }): Promise<Schemas.ListGitBranchesResponse> {
    return operationsByTag.branch.getGitBranchesMapping({
      pathParams: { workspace, region, dbName: database },
      ...this.extraProps
    });
  }

  public addGitBranchesEntry({
    workspace,
    region,
    database,
    gitBranch,
    xataBranch
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    gitBranch: string;
    xataBranch: Schemas.BranchName;
  }): Promise<Types.AddGitBranchesEntryResponse> {
    return operationsByTag.branch.addGitBranchesEntry({
      pathParams: { workspace, region, dbName: database },
      body: { gitBranch, xataBranch },
      ...this.extraProps
    });
  }

  public removeGitBranchesEntry({
    workspace,
    region,
    database,
    gitBranch
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    gitBranch: string;
  }): Promise<void> {
    return operationsByTag.branch.removeGitBranchesEntry({
      pathParams: { workspace, region, dbName: database },
      queryParams: { gitBranch },
      ...this.extraProps
    });
  }

  public resolveBranch({
    workspace,
    region,
    database,
    gitBranch,
    fallbackBranch
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    gitBranch?: string;
    fallbackBranch?: string;
  }): Promise<Types.ResolveBranchResponse> {
    return operationsByTag.branch.resolveBranch({
      pathParams: { workspace, region, dbName: database },
      queryParams: { gitBranch, fallbackBranch },
      ...this.extraProps
    });
  }

  public pgRollMigrationHistory({
    workspace,
    region,
    database,
    branch
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
  }): Promise<Schemas.MigrationHistoryResponse> {
    return operationsByTag.migrations.getMigrationHistory({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      ...this.extraProps
    });
  }

  public applyMigration({
    workspace,
    region,
    database,
    branch,
    migration
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    migration: Schemas.Migration;
  }): Promise<Schemas.ApplyMigrationResponse> {
    return operationsByTag.migrations.applyMigration({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      body: migration,
      ...this.extraProps
    });
  }
}

class TableApi {
  constructor(private extraProps: ApiExtraProps) {}

  public createTable({
    workspace,
    region,
    database,
    branch,
    table
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
  }): Promise<Types.CreateTableResponse> {
    return operationsByTag.table.createTable({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table },
      ...this.extraProps
    });
  }

  public deleteTable({
    workspace,
    region,
    database,
    branch,
    table
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
  }): Promise<Components.DeleteTableResponse> {
    return operationsByTag.table.deleteTable({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table },
      ...this.extraProps
    });
  }

  public updateTable({
    workspace,
    region,
    database,
    branch,
    table,
    update
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    update: Types.UpdateTableRequestBody;
  }): Promise<Responses.SchemaUpdateResponse> {
    return operationsByTag.table.updateTable({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table },
      body: update,
      ...this.extraProps
    });
  }

  public getTableSchema({
    workspace,
    region,
    database,
    branch,
    table
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
  }): Promise<Types.GetTableSchemaResponse> {
    return operationsByTag.table.getTableSchema({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table },
      ...this.extraProps
    });
  }

  public setTableSchema({
    workspace,
    region,
    database,
    branch,
    table,
    schema
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    schema: Types.SetTableSchemaRequestBody;
  }): Promise<Responses.SchemaUpdateResponse> {
    return operationsByTag.table.setTableSchema({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table },
      body: schema,
      ...this.extraProps
    });
  }

  public getTableColumns({
    workspace,
    region,
    database,
    branch,
    table
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
  }): Promise<Types.GetTableColumnsResponse> {
    return operationsByTag.table.getTableColumns({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table },
      ...this.extraProps
    });
  }

  public addTableColumn({
    workspace,
    region,
    database,
    branch,
    table,
    column
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    column: Schemas.Column;
  }): Promise<Responses.SchemaUpdateResponse> {
    return operationsByTag.table.addTableColumn({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table },
      body: column,
      ...this.extraProps
    });
  }

  public getColumn({
    workspace,
    region,
    database,
    branch,
    table,
    column
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    column: Schemas.ColumnName;
  }): Promise<Schemas.Column> {
    return operationsByTag.table.getColumn({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table, columnName: column },
      ...this.extraProps
    });
  }

  public updateColumn({
    workspace,
    region,
    database,
    branch,
    table,
    column,
    update
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    column: Schemas.ColumnName;
    update: Types.UpdateColumnRequestBody;
  }): Promise<Responses.SchemaUpdateResponse> {
    return operationsByTag.table.updateColumn({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table, columnName: column },
      body: update,
      ...this.extraProps
    });
  }

  public deleteColumn({
    workspace,
    region,
    database,
    branch,
    table,
    column
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    column: Schemas.ColumnName;
  }): Promise<Responses.SchemaUpdateResponse> {
    return operationsByTag.table.deleteColumn({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table, columnName: column },
      ...this.extraProps
    });
  }
}

class RecordsApi {
  constructor(private extraProps: ApiExtraProps) {}

  public insertRecord({
    workspace,
    region,
    database,
    branch,
    table,
    record,
    columns
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    record: Record<string, any>;
    columns?: Schemas.ColumnsProjection;
  }): Promise<Responses.RecordUpdateResponse> {
    return operationsByTag.records.insertRecord({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table },
      queryParams: { columns },
      body: record,
      ...this.extraProps
    });
  }

  public getRecord({
    workspace,
    region,
    database,
    branch,
    table,
    id,
    columns
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    id: Schemas.RecordID;
    columns?: Schemas.ColumnsProjection;
  }): Promise<Schemas.XataRecord> {
    return operationsByTag.records.getRecord({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table, recordId: id },
      queryParams: { columns },
      ...this.extraProps
    });
  }

  public insertRecordWithID({
    workspace,
    region,
    database,
    branch,
    table,
    id,
    record,
    columns,
    createOnly,
    ifVersion
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    id: Schemas.RecordID;
    record: Record<string, any>;
    columns?: Schemas.ColumnsProjection;
    createOnly?: boolean;
    ifVersion?: number;
  }): Promise<Responses.RecordUpdateResponse> {
    return operationsByTag.records.insertRecordWithID({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table, recordId: id },
      queryParams: { columns, createOnly, ifVersion },
      body: record,
      ...this.extraProps
    });
  }

  public updateRecordWithID({
    workspace,
    region,
    database,
    branch,
    table,
    id,
    record,
    columns,
    ifVersion
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    id: Schemas.RecordID;
    record: Record<string, any>;
    columns?: Schemas.ColumnsProjection;
    ifVersion?: number;
  }): Promise<Responses.RecordUpdateResponse> {
    return operationsByTag.records.updateRecordWithID({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table, recordId: id },
      queryParams: { columns, ifVersion },
      body: record,
      ...this.extraProps
    });
  }

  public upsertRecordWithID({
    workspace,
    region,
    database,
    branch,
    table,
    id,
    record,
    columns,
    ifVersion
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    id: Schemas.RecordID;
    record: Record<string, any>;
    columns?: Schemas.ColumnsProjection;
    ifVersion?: number;
  }): Promise<Responses.RecordUpdateResponse> {
    return operationsByTag.records.upsertRecordWithID({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table, recordId: id },
      queryParams: { columns, ifVersion },
      body: record,
      ...this.extraProps
    });
  }

  public deleteRecord({
    workspace,
    region,
    database,
    branch,
    table,
    id,
    columns
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    id: Schemas.RecordID;
    columns?: Schemas.ColumnsProjection;
  }): Promise<Responses.RecordUpdateResponse> {
    return operationsByTag.records.deleteRecord({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table, recordId: id },
      queryParams: { columns },
      ...this.extraProps
    });
  }

  public bulkInsertTableRecords({
    workspace,
    region,
    database,
    branch,
    table,
    records,
    columns
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    records: Record<string, any>[];
    columns?: Schemas.ColumnsProjection;
  }): Promise<Responses.BulkInsertResponse> {
    return operationsByTag.records.bulkInsertTableRecords({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table },
      queryParams: { columns },
      body: { records },
      ...this.extraProps
    });
  }

  public branchTransaction({
    workspace,
    region,
    database,
    branch,
    operations
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    operations: Schemas.TransactionOperation[];
  }): Promise<Schemas.TransactionSuccess> {
    return operationsByTag.records.branchTransaction({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      body: { operations },
      ...this.extraProps
    });
  }
}

class FilesApi {
  constructor(private extraProps: ApiExtraProps) {}

  public getFileItem({
    workspace,
    region,
    database,
    branch,
    table,
    record,
    column,
    fileId
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    record: Schemas.RecordID;
    column: Schemas.ColumnName;
    fileId: string;
  }): Promise<any> {
    return operationsByTag.files.getFileItem({
      pathParams: {
        workspace,
        region,
        dbBranchName: `${database}:${branch}`,
        tableName: table,
        recordId: record,
        columnName: column,
        fileId
      },
      ...this.extraProps
    });
  }

  public putFileItem({
    workspace,
    region,
    database,
    branch,
    table,
    record,
    column,
    fileId,
    file
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    record: Schemas.RecordID;
    column: Schemas.ColumnName;
    fileId: string;
    file: any;
  }): Promise<Responses.PutFileResponse> {
    return operationsByTag.files.putFileItem({
      pathParams: {
        workspace,
        region,
        dbBranchName: `${database}:${branch}`,
        tableName: table,
        recordId: record,
        columnName: column,
        fileId
      },
      // @ts-ignore
      body: file,
      ...this.extraProps
    });
  }

  public deleteFileItem({
    workspace,
    region,
    database,
    branch,
    table,
    record,
    column,
    fileId
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    record: Schemas.RecordID;
    column: Schemas.ColumnName;
    fileId: string;
  }): Promise<Responses.PutFileResponse> {
    return operationsByTag.files.deleteFileItem({
      pathParams: {
        workspace,
        region,
        dbBranchName: `${database}:${branch}`,
        tableName: table,
        recordId: record,
        columnName: column,
        fileId
      },
      ...this.extraProps
    });
  }

  public getFile({
    workspace,
    region,
    database,
    branch,
    table,
    record,
    column
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    record: Schemas.RecordID;
    column: Schemas.ColumnName;
  }): Promise<any> {
    return operationsByTag.files.getFile({
      pathParams: {
        workspace,
        region,
        dbBranchName: `${database}:${branch}`,
        tableName: table,
        recordId: record,
        columnName: column
      },
      ...this.extraProps
    });
  }

  public putFile({
    workspace,
    region,
    database,
    branch,
    table,
    record,
    column,
    file
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    record: Schemas.RecordID;
    column: Schemas.ColumnName;
    file: Blob;
  }): Promise<Responses.PutFileResponse> {
    return operationsByTag.files.putFile({
      pathParams: {
        workspace,
        region,
        dbBranchName: `${database}:${branch}`,
        tableName: table,
        recordId: record,
        columnName: column
      },
      body: file,
      ...this.extraProps
    });
  }

  public deleteFile({
    workspace,
    region,
    database,
    branch,
    table,
    record,
    column
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    record: Schemas.RecordID;
    column: Schemas.ColumnName;
  }): Promise<Responses.PutFileResponse> {
    return operationsByTag.files.deleteFile({
      pathParams: {
        workspace,
        region,
        dbBranchName: `${database}:${branch}`,
        tableName: table,
        recordId: record,
        columnName: column
      },
      ...this.extraProps
    });
  }

  public fileAccess({
    workspace,
    region,
    fileId,
    verify
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    fileId: string;
    verify?: Schemas.FileSignature;
  }): Promise<any> {
    return operationsByTag.files.fileAccess({
      pathParams: {
        workspace,
        region,
        fileId
      },
      queryParams: { verify },
      ...this.extraProps
    });
  }
}

class SearchAndFilterApi {
  constructor(private extraProps: ApiExtraProps) {}

  public queryTable({
    workspace,
    region,
    database,
    branch,
    table,
    filter,
    sort,
    page,
    columns,
    consistency
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    filter?: Schemas.FilterExpression;
    sort?: Schemas.SortExpression;
    page?: Schemas.PageConfig;
    columns?: Schemas.ColumnsProjection;
    consistency?: 'strong' | 'eventual';
  }): Promise<Responses.QueryResponse> {
    return operationsByTag.searchAndFilter.queryTable({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table },
      body: { filter, sort, page, columns, consistency },
      ...this.extraProps
    });
  }

  public searchTable({
    workspace,
    region,
    database,
    branch,
    table,
    query,
    fuzziness,
    target,
    prefix,
    filter,
    highlight,
    boosters
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    query: string;
    fuzziness?: Schemas.FuzzinessExpression;
    target?: Schemas.TargetExpression;
    prefix?: Schemas.PrefixExpression;
    filter?: Schemas.FilterExpression;
    highlight?: Schemas.HighlightExpression;
    boosters?: Schemas.BoosterExpression[];
  }): Promise<Responses.SearchResponse> {
    return operationsByTag.searchAndFilter.searchTable({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table },
      body: { query, fuzziness, target, prefix, filter, highlight, boosters },
      ...this.extraProps
    });
  }

  public searchBranch({
    workspace,
    region,
    database,
    branch,
    tables,
    query,
    fuzziness,
    prefix,
    highlight
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    tables?: (
      | string
      | {
          table: string;
          filter?: Schemas.FilterExpression;
          target?: Schemas.TargetExpression;
          boosters?: Schemas.BoosterExpression[];
        }
    )[];
    query: string;
    fuzziness?: Schemas.FuzzinessExpression;
    prefix?: Schemas.PrefixExpression;
    highlight?: Schemas.HighlightExpression;
  }): Promise<Responses.SearchResponse> {
    return operationsByTag.searchAndFilter.searchBranch({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      body: { tables, query, fuzziness, prefix, highlight },
      ...this.extraProps
    });
  }

  public vectorSearchTable({
    workspace,
    region,
    database,
    branch,
    table,
    queryVector,
    column,
    similarityFunction,
    size,
    filter
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    queryVector: number[];
    column: string;
    similarityFunction?: string;
    size?: number;
    filter?: Schemas.FilterExpression;
  }): Promise<Responses.SearchResponse> {
    return operationsByTag.searchAndFilter.vectorSearchTable({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table },
      body: { queryVector, column, similarityFunction, size, filter },
      ...this.extraProps
    });
  }

  public askTable({
    workspace,
    region,
    database,
    branch,
    table,
    options
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    options: Components.AskTableRequestBody;
  }): Promise<Components.AskTableResponse> {
    return operationsByTag.searchAndFilter.askTable({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table },
      body: { ...options },
      ...this.extraProps
    });
  }

  public askTableSession({
    workspace,
    region,
    database,
    branch,
    table,
    sessionId,
    message
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    sessionId: string;
    message: string;
  }): Promise<Components.AskTableSessionResponse> {
    return operationsByTag.searchAndFilter.askTableSession({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table, sessionId },
      body: { message },
      ...this.extraProps
    });
  }

  public summarizeTable({
    workspace,
    region,
    database,
    branch,
    table,
    filter,
    columns,
    summaries,
    sort,
    summariesFilter,
    page,
    consistency
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    filter?: Schemas.FilterExpression;
    columns?: Schemas.ColumnsProjection;
    summaries?: Schemas.SummaryExpressionList;
    sort?: Schemas.SortExpression;
    summariesFilter?: Schemas.FilterExpression;
    page?: { size?: number };
    consistency?: 'strong' | 'eventual';
  }): Promise<Responses.SummarizeResponse> {
    return operationsByTag.searchAndFilter.summarizeTable({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table },
      body: { filter, columns, summaries, sort, summariesFilter, page, consistency },
      ...this.extraProps
    });
  }

  public aggregateTable({
    workspace,
    region,
    database,
    branch,
    table,
    filter,
    aggs
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    table: Schemas.TableName;
    filter?: Schemas.FilterExpression;
    aggs?: Schemas.AggExpressionMap;
  }): Promise<Responses.AggResponse> {
    return operationsByTag.searchAndFilter.aggregateTable({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, tableName: table },
      body: { filter, aggs },
      ...this.extraProps
    });
  }
}

class MigrationRequestsApi {
  constructor(private extraProps: ApiExtraProps) {}

  public queryMigrationRequests({
    workspace,
    region,
    database,
    filter,
    sort,
    page,
    columns
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    filter?: Schemas.FilterExpression;
    sort?: Schemas.SortExpression;
    page?: Schemas.PageConfig;
    columns?: Schemas.ColumnsProjection;
  }): Promise<Components.QueryMigrationRequestsResponse> {
    return operationsByTag.migrationRequests.queryMigrationRequests({
      pathParams: { workspace, region, dbName: database },
      body: { filter, sort, page, columns },
      ...this.extraProps
    });
  }

  public createMigrationRequest({
    workspace,
    region,
    database,
    migration
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    migration: Components.CreateMigrationRequestRequestBody;
  }): Promise<Components.CreateMigrationRequestResponse> {
    return operationsByTag.migrationRequests.createMigrationRequest({
      pathParams: { workspace, region, dbName: database },
      body: migration,
      ...this.extraProps
    });
  }

  public getMigrationRequest({
    workspace,
    region,
    database,
    migrationRequest
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    migrationRequest: Schemas.MigrationRequestNumber;
  }): Promise<Schemas.MigrationRequest> {
    return operationsByTag.migrationRequests.getMigrationRequest({
      pathParams: { workspace, region, dbName: database, mrNumber: migrationRequest },
      ...this.extraProps
    });
  }

  public updateMigrationRequest({
    workspace,
    region,
    database,
    migrationRequest,
    update
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    migrationRequest: Schemas.MigrationRequestNumber;
    update: Components.UpdateMigrationRequestRequestBody;
  }): Promise<void> {
    return operationsByTag.migrationRequests.updateMigrationRequest({
      pathParams: { workspace, region, dbName: database, mrNumber: migrationRequest },
      body: update,
      ...this.extraProps
    });
  }

  public listMigrationRequestsCommits({
    workspace,
    region,
    database,
    migrationRequest,
    page
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    migrationRequest: Schemas.MigrationRequestNumber;
    page?: { after?: string; before?: string; size?: number };
  }): Promise<Components.ListMigrationRequestsCommitsResponse> {
    return operationsByTag.migrationRequests.listMigrationRequestsCommits({
      pathParams: { workspace, region, dbName: database, mrNumber: migrationRequest },
      body: { page },
      ...this.extraProps
    });
  }

  public compareMigrationRequest({
    workspace,
    region,
    database,
    migrationRequest
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    migrationRequest: Schemas.MigrationRequestNumber;
  }): Promise<Responses.SchemaCompareResponse> {
    return operationsByTag.migrationRequests.compareMigrationRequest({
      pathParams: { workspace, region, dbName: database, mrNumber: migrationRequest },
      ...this.extraProps
    });
  }

  public getMigrationRequestIsMerged({
    workspace,
    region,
    database,
    migrationRequest
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    migrationRequest: Schemas.MigrationRequestNumber;
  }): Promise<Components.GetMigrationRequestIsMergedResponse> {
    return operationsByTag.migrationRequests.getMigrationRequestIsMerged({
      pathParams: { workspace, region, dbName: database, mrNumber: migrationRequest },
      ...this.extraProps
    });
  }

  public mergeMigrationRequest({
    workspace,
    region,
    database,
    migrationRequest
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    migrationRequest: Schemas.MigrationRequestNumber;
  }): Promise<Schemas.BranchOp> {
    return operationsByTag.migrationRequests.mergeMigrationRequest({
      pathParams: { workspace, region, dbName: database, mrNumber: migrationRequest },
      ...this.extraProps
    });
  }
}

class MigrationsApi {
  constructor(private extraProps: ApiExtraProps) {}

  public getBranchMigrationHistory({
    workspace,
    region,
    database,
    branch,
    limit,
    startFrom
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    limit?: number;
    startFrom?: string;
  }): Promise<Types.GetBranchMigrationHistoryResponse> {
    return operationsByTag.migrations.getBranchMigrationHistory({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      body: { limit, startFrom },
      ...this.extraProps
    });
  }

  public getBranchMigrationPlan({
    workspace,
    region,
    database,
    branch,
    schema
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    schema: Schemas.Schema;
  }): Promise<Responses.BranchMigrationPlan> {
    return operationsByTag.migrations.getBranchMigrationPlan({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      body: schema,
      ...this.extraProps
    });
  }

  public executeBranchMigrationPlan({
    workspace,
    region,
    database,
    branch,
    plan
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    plan: Types.ExecuteBranchMigrationPlanRequestBody;
  }): Promise<Responses.SchemaUpdateResponse> {
    return operationsByTag.migrations.executeBranchMigrationPlan({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      body: plan,
      ...this.extraProps
    });
  }

  public getBranchSchemaHistory({
    workspace,
    region,
    database,
    branch,
    page
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    page?: { after?: string; before?: string; size?: number };
  }): Promise<Types.GetBranchSchemaHistoryResponse> {
    return operationsByTag.migrations.getBranchSchemaHistory({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      body: { page },
      ...this.extraProps
    });
  }

  public compareBranchWithUserSchema({
    workspace,
    region,
    database,
    branch,
    schema,
    schemaOperations,
    branchOperations
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    schema: Schemas.Schema;
    schemaOperations?: Schemas.MigrationOp[];
    branchOperations?: Schemas.MigrationOp[];
  }): Promise<Responses.SchemaCompareResponse> {
    return operationsByTag.migrations.compareBranchWithUserSchema({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      body: { schema, schemaOperations, branchOperations },
      ...this.extraProps
    });
  }

  public compareBranchSchemas({
    workspace,
    region,
    database,
    branch,
    compare,
    sourceBranchOperations,
    targetBranchOperations
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    compare: Schemas.BranchName;
    sourceBranchOperations?: Schemas.MigrationOp[];
    targetBranchOperations?: Schemas.MigrationOp[];
  }): Promise<Responses.SchemaCompareResponse> {
    return operationsByTag.migrations.compareBranchSchemas({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, branchName: compare },
      body: { sourceBranchOperations, targetBranchOperations },
      ...this.extraProps
    });
  }

  public updateBranchSchema({
    workspace,
    region,
    database,
    branch,
    migration
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    migration: Schemas.Migration;
  }): Promise<Responses.SchemaUpdateResponse> {
    return operationsByTag.migrations.updateBranchSchema({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      body: migration,
      ...this.extraProps
    });
  }

  public previewBranchSchemaEdit({
    workspace,
    region,
    database,
    branch,
    data
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    data: { edits?: Schemas.SchemaEditScript };
  }): Promise<Components.PreviewBranchSchemaEditResponse> {
    return operationsByTag.migrations.previewBranchSchemaEdit({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      body: data,
      ...this.extraProps
    });
  }

  public applyBranchSchemaEdit({
    workspace,
    region,
    database,
    branch,
    edits
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    edits: Schemas.SchemaEditScript;
  }): Promise<Responses.SchemaUpdateResponse> {
    return operationsByTag.migrations.applyBranchSchemaEdit({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      body: { edits },
      ...this.extraProps
    });
  }

  public pushBranchMigrations({
    workspace,
    region,
    database,
    branch,
    migrations
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
    migrations: Schemas.MigrationObject[];
  }): Promise<Responses.SchemaUpdateResponse> {
    return operationsByTag.migrations.pushBranchMigrations({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      body: { migrations },
      ...this.extraProps
    });
  }

  public getSchema({
    workspace,
    region,
    database,
    branch
  }: {
    workspace: Schemas.WorkspaceID;
    region: string;
    database: Schemas.DBName;
    branch: Schemas.BranchName;
  }): Promise<Components.GetSchemaResponse> {
    return operationsByTag.migrations.getSchema({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      ...this.extraProps
    });
  }
}

class DatabaseApi {
  constructor(private extraProps: ApiExtraProps) {}

  public getDatabaseList({ workspace }: { workspace: Schemas.WorkspaceID }): Promise<Schemas.ListDatabasesResponse> {
    return operationsByTag.databases.getDatabaseList({
      pathParams: { workspaceId: workspace },
      ...this.extraProps
    });
  }

  public createDatabase({
    workspace,
    database,
    data,
    headers
  }: {
    workspace: Schemas.WorkspaceID;
    database: Schemas.DBName;
    data: Components.CreateDatabaseRequestBody;
    headers?: Record<string, string>;
  }): Promise<Components.CreateDatabaseResponse> {
    return operationsByTag.databases.createDatabase({
      pathParams: { workspaceId: workspace, dbName: database },
      body: data,
      headers,
      ...this.extraProps
    });
  }

  public deleteDatabase({
    workspace,
    database
  }: {
    workspace: Schemas.WorkspaceID;
    database: Schemas.DBName;
  }): Promise<Components.DeleteDatabaseResponse> {
    return operationsByTag.databases.deleteDatabase({
      pathParams: { workspaceId: workspace, dbName: database },
      ...this.extraProps
    });
  }

  public getDatabaseMetadata({
    workspace,
    database
  }: {
    workspace: Schemas.WorkspaceID;
    database: Schemas.DBName;
  }): Promise<Schemas.DatabaseMetadata> {
    return operationsByTag.databases.getDatabaseMetadata({
      pathParams: { workspaceId: workspace, dbName: database },
      ...this.extraProps
    });
  }

  public updateDatabaseMetadata({
    workspace,
    database,
    metadata
  }: {
    workspace: Schemas.WorkspaceID;
    database: Schemas.DBName;
    metadata: Schemas.DatabaseMetadata;
  }): Promise<Schemas.DatabaseMetadata> {
    return operationsByTag.databases.updateDatabaseMetadata({
      pathParams: { workspaceId: workspace, dbName: database },
      body: metadata,
      ...this.extraProps
    });
  }

  public renameDatabase({
    workspace,
    database,
    newName
  }: {
    workspace: Schemas.WorkspaceID;
    database: Schemas.DBName;
    newName: Schemas.DBName;
  }): Promise<Schemas.DatabaseMetadata> {
    return operationsByTag.databases.renameDatabase({
      pathParams: { workspaceId: workspace, dbName: database },
      body: { newName },
      ...this.extraProps
    });
  }

  public getDatabaseGithubSettings({
    workspace,
    database
  }: {
    workspace: Schemas.WorkspaceID;
    database: Schemas.DBName;
  }): Promise<Schemas.DatabaseGithubSettings> {
    return operationsByTag.databases.getDatabaseGithubSettings({
      pathParams: { workspaceId: workspace, dbName: database },
      ...this.extraProps
    });
  }

  public updateDatabaseGithubSettings({
    workspace,
    database,
    settings
  }: {
    workspace: Schemas.WorkspaceID;
    database: Schemas.DBName;
    settings: Schemas.DatabaseGithubSettings;
  }): Promise<Schemas.DatabaseGithubSettings> {
    return operationsByTag.databases.updateDatabaseGithubSettings({
      pathParams: { workspaceId: workspace, dbName: database },
      body: settings,
      ...this.extraProps
    });
  }

  public deleteDatabaseGithubSettings({
    workspace,
    database
  }: {
    workspace: Schemas.WorkspaceID;
    database: Schemas.DBName;
  }): Promise<void> {
    return operationsByTag.databases.deleteDatabaseGithubSettings({
      pathParams: { workspaceId: workspace, dbName: database },
      ...this.extraProps
    });
  }

  public listRegions({ workspace }: { workspace: Schemas.WorkspaceID }): Promise<Schemas.ListRegionsResponse> {
    return operationsByTag.databases.listRegions({
      pathParams: { workspaceId: workspace },
      ...this.extraProps
    });
  }
}
