import { deleteFile, deleteFileItem, fileAccess, getFile, getFileItem, putFile, putFileItem } from '../api';
import { FileResponse, FileSignature } from '../api/dataPlaneSchemas';
import { XataPlugin, XataPluginOptions } from '../plugins';
import { ColumnsByValue, XataArrayFile, XataFile } from '../schema';
import { BaseData, XataRecord } from '../schema/record';
import { GetArrayInnerType, StringKeys, Values } from '../util/types';

export type BinaryFile = string | Blob | ArrayBuffer;

export type FilesPluginResult<Schemas extends Record<string, BaseData>> = {
  download: <Tables extends StringKeys<Schemas>>(
    meta: UploadDestination<Schemas, Tables, XataFile> | UploadDestination<Schemas, Tables, XataArrayFile[]>
  ) => Promise<Blob>;
  upload: <Tables extends StringKeys<Schemas>>(
    meta: UploadDestination<Schemas, Tables, XataFile> | UploadDestination<Schemas, Tables, XataArrayFile[]>,
    file: BinaryFile
  ) => Promise<FileResponse>;
  delete: <Tables extends StringKeys<Schemas>>(
    meta: UploadDestination<Schemas, Tables, XataFile> | UploadDestination<Schemas, Tables, XataArrayFile[]>
  ) => Promise<FileResponse>;
  read: (id: string, options?: { verify?: FileSignature }) => Promise<Blob>;
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
      download: async (meta: Record<string, string>) => {
        const { table, record, column, fileId } = meta ?? {};
        const common = {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}',
          tableName: table,
          recordId: record,
          columnName: column
        };

        if (fileId) {
          return await getFileItem({ pathParams: { ...common, fileId }, ...pluginOptions, rawResponse: true });
        } else {
          return await getFile({ pathParams: common, ...pluginOptions, rawResponse: true });
        }
      },
      upload: async (meta: Record<string, string>, file: BinaryFile) => {
        const { table, record, column, fileId } = meta ?? {};
        const common = {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}',
          tableName: table,
          recordId: record,
          columnName: column
        };

        if (fileId) {
          return await putFileItem({ pathParams: { ...common, fileId }, body: file as Blob, ...pluginOptions });
        } else {
          return await putFile({ pathParams: common, body: file as Blob, ...pluginOptions });
        }
      },
      delete: async (meta: Record<string, string>) => {
        const { table, record, column, fileId } = meta ?? {};
        const common = {
          workspace: '{workspaceId}',
          dbBranchName: '{dbBranch}',
          region: '{region}',
          tableName: table,
          recordId: record,
          columnName: column
        };

        if (fileId) {
          return await deleteFileItem({ pathParams: { ...common, fileId }, ...pluginOptions });
        } else {
          return await deleteFile({ pathParams: common, ...pluginOptions });
        }
      },
      read: async (id: string, options?: { verify?: FileSignature }) => {
        return await fileAccess({
          pathParams: { workspace: '{workspaceId}', region: '{region}', fileId: id },
          queryParams: { verify: options?.verify },
          rawResponse: true,
          ...pluginOptions
        });
      }
    };
  }
}
