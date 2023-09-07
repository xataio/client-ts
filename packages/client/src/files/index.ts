import { deleteFileItem, getFileItem, putFileItem } from '../api';
import { FileResponse } from '../api/dataPlaneSchemas';
import { XataPlugin, XataPluginOptions } from '../plugins';
import { ColumnsByValue, XataArrayFile, XataFile } from '../schema';
import { BaseData, XataRecord } from '../schema/record';
import { GetArrayInnerType, StringKeys, Values } from '../util/types';

export type BinaryFile = string | Blob | ArrayBuffer;

export type FilesPluginResult<Schemas extends Record<string, BaseData>> = {
  download: <Tables extends StringKeys<Schemas>>(location: DownloadDestination<Schemas, Tables>) => Promise<Blob>;
  upload: <Tables extends StringKeys<Schemas>>(
    location: UploadDestination<Schemas, Tables>,
    file: BinaryFile
  ) => Promise<FileResponse>;
  delete: <Tables extends StringKeys<Schemas>>(location: DownloadDestination<Schemas, Tables>) => Promise<FileResponse>;
};

export type UploadDestination<Schemas extends Record<string, BaseData>, Tables extends StringKeys<Schemas>> = Values<{
  [Model in GetArrayInnerType<NonNullable<Tables[]>>]:
    | {
        table: Model;
        column: ColumnsByValue<Schemas[Model], XataFile>;
        record: string;
      }
    | {
        table: Model;
        column: ColumnsByValue<Schemas[Model], XataArrayFile[]>;
        record: string;
        fileId?: string;
      };
}>;

export type DownloadDestination<Schemas extends Record<string, BaseData>, Tables extends StringKeys<Schemas>> = Values<{
  [Model in GetArrayInnerType<NonNullable<Tables[]>>]:
    | {
        table: Model;
        column: ColumnsByValue<Schemas[Model], XataFile>;
        record: string;
      }
    | {
        table: Model;
        column: ColumnsByValue<Schemas[Model], XataArrayFile[]>;
        record: string;
        fileId: string;
      };
}>;

export class FilesPlugin<Schemas extends Record<string, XataRecord>> extends XataPlugin {
  build(pluginOptions: XataPluginOptions): FilesPluginResult<Schemas> {
    return {
      download: async (location: Record<string, string | undefined>) => {
        const { table, record, column, fileId = '' } = location ?? {};

        return await getFileItem({
          pathParams: {
            workspace: '{workspaceId}',
            dbBranchName: '{dbBranch}',
            region: '{region}',
            tableName: table ?? '',
            recordId: record ?? '',
            columnName: column ?? '',
            fileId
          },
          ...pluginOptions,
          rawResponse: true
        });
      },
      upload: async (location: Record<string, string | undefined>, file: BinaryFile) => {
        const { table, record, column, fileId = '' } = location ?? {};
        const contentType = getContentType(file);

        try {
          console.log('Uploading file', { table, record, column });
          return await putFileItem({
            ...pluginOptions,
            pathParams: {
              workspace: '{workspaceId}',
              dbBranchName: '{dbBranch}',
              region: '{region}',
              tableName: table ?? '',
              recordId: record ?? '',
              columnName: column ?? '',
              fileId
            },
            body: file as Blob,
            headers: { 'Content-Type': contentType }
          });
        } catch (error) {
          console.error(`Error uploading file`, error);
          throw error;
        }
      },
      delete: async (location: Record<string, string | undefined>) => {
        const { table, record, column, fileId = '' } = location ?? {};

        return await deleteFileItem({
          pathParams: {
            workspace: '{workspaceId}',
            dbBranchName: '{dbBranch}',
            region: '{region}',
            tableName: table ?? '',
            recordId: record ?? '',
            columnName: column ?? '',
            fileId
          },
          ...pluginOptions
        });
      }
    };
  }
}

function getContentType(file: BinaryFile): string {
  if (typeof file === 'string') {
    return 'text/plain';
  }

  if (file instanceof Blob) {
    return file.type;
  }

  try {
    // Check for Blobs that are not instances of Blob
    return (file as any).type;
  } catch (e) {
    // ignore
  }

  return 'application/octet-stream';
}
