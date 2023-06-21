import { deleteFile, deleteFileItem, fileAccess, getFile, getFileItem, putFile, putFileItem } from '../api';
import { FileResponse, FileSignature } from '../api/dataPlaneSchemas';
import { XataPlugin, XataPluginOptions } from '../plugins';
import { ColumnsByValue, XataArrayFile, XataFile } from '../schema';
import { BaseData, XataRecord } from '../schema/record';
import { GetArrayInnerType, StringKeys, Values } from '../util/types';

export type BinaryFile = string | Blob | ArrayBuffer | FormData | ReadableStream;

export type FilesPluginResult<Schemas extends Record<string, BaseData>> = {
  getFileItem: <Tables extends StringKeys<Schemas>>(
    meta: UploadDestination<Schemas, Tables, XataArrayFile[]>
  ) => Promise<Blob>;
  getFile: <Tables extends StringKeys<Schemas>>(meta: UploadDestination<Schemas, Tables, XataFile>) => Promise<Blob>;
  putFileItem: <Tables extends StringKeys<Schemas>>(
    meta: UploadDestination<Schemas, Tables, XataArrayFile[]>,
    file: BinaryFile
  ) => Promise<FileResponse>;
  putFile: <Tables extends StringKeys<Schemas>>(
    meta: UploadDestination<Schemas, Tables, XataFile>,
    file: BinaryFile
  ) => Promise<FileResponse>;
  deleteFileItem: <Tables extends StringKeys<Schemas>>(
    meta: UploadDestination<Schemas, Tables, XataArrayFile[]>
  ) => Promise<FileResponse>;
  deleteFile: <Tables extends StringKeys<Schemas>>(
    meta: UploadDestination<Schemas, Tables, XataFile>
  ) => Promise<FileResponse>;
  fileAccess: (
    id: string,
    options?: {
      verify?: FileSignature;
    }
  ) => Promise<Blob>;
};

export type UploadDestination<
  Schemas extends Record<string, BaseData>,
  Tables extends StringKeys<Schemas>,
  Type extends XataFile | XataFile[]
> = Values<{
  [Model in GetArrayInnerType<NonNullable<Tables[]>>]: {
    table: Model;
    column: ColumnsByValue<Schemas[Model], Type>;
    record: string;
  } & (Type extends XataFile[] ? { fileId: string } : {});
}>;

export class FilesPlugin<Schemas extends Record<string, XataRecord>> extends XataPlugin {
  build(pluginOptions: XataPluginOptions): FilesPluginResult<Schemas> {
    return {
      getFileItem: async <Tables extends StringKeys<Schemas>>(
        meta: UploadDestination<Schemas, Tables, XataArrayFile[]>
      ) => {
        return await getFileItem({
          pathParams: {
            workspace: '{workspaceId}',
            dbBranchName: '{dbBranch}',
            region: '{region}',
            tableName: meta.table,
            recordId: meta.record,
            columnName: meta.column,
            fileId: meta.fileId
          },
          ...pluginOptions,
          rawResponse: true
        });
      },
      getFile: async <Tables extends StringKeys<Schemas>>(meta: UploadDestination<Schemas, Tables, XataFile>) => {
        return await getFile({
          pathParams: {
            workspace: '{workspaceId}',
            dbBranchName: '{dbBranch}',
            region: '{region}',
            tableName: meta.table,
            recordId: meta.record,
            columnName: meta.column
          },
          ...pluginOptions,
          rawResponse: true
        });
      },
      putFileItem: async <Tables extends StringKeys<Schemas>>(
        meta: UploadDestination<Schemas, Tables, XataArrayFile[]>,
        file: BinaryFile
      ) => {
        return await putFileItem({
          pathParams: {
            workspace: '{workspaceId}',
            dbBranchName: '{dbBranch}',
            region: '{region}',
            tableName: meta.table,
            recordId: meta.record,
            columnName: meta.column,
            fileId: meta.fileId
          },
          body: file as Blob,
          headers: { 'Content-Type': undefined },
          ...pluginOptions
        });
      },
      putFile: async <Tables extends StringKeys<Schemas>>(
        meta: UploadDestination<Schemas, Tables, XataFile>,
        file: BinaryFile
      ) => {
        return await putFile({
          pathParams: {
            workspace: '{workspaceId}',
            dbBranchName: '{dbBranch}',
            region: '{region}',
            tableName: meta.table,
            recordId: meta.record,
            columnName: meta.column
          },
          body: file as Blob,
          headers: { 'Content-Type': undefined },
          ...pluginOptions
        });
      },
      deleteFileItem: async <Tables extends StringKeys<Schemas>>(
        meta: UploadDestination<Schemas, Tables, XataArrayFile[]>
      ) => {
        return await deleteFileItem({
          pathParams: {
            workspace: '{workspaceId}',
            dbBranchName: '{dbBranch}',
            region: '{region}',
            tableName: meta.table,
            recordId: meta.record,
            columnName: meta.column,
            fileId: meta.fileId
          },
          ...pluginOptions
        });
      },
      deleteFile: async <Tables extends StringKeys<Schemas>>(meta: UploadDestination<Schemas, Tables, XataFile>) => {
        return await deleteFile({
          pathParams: {
            workspace: '{workspaceId}',
            dbBranchName: '{dbBranch}',
            region: '{region}',
            tableName: meta.table,
            recordId: meta.record,
            columnName: meta.column
          },
          ...pluginOptions
        });
      },
      fileAccess: async (
        id: string,
        options?: {
          verify?: FileSignature;
        }
      ) => {
        return await fileAccess({
          pathParams: {
            workspace: '{workspaceId}',
            region: '{region}',
            fileId: id
          },
          queryParams: {
            verify: options?.verify
          },
          rawResponse: true,
          ...pluginOptions
        });
      }
    };
  }
}
