import { deleteFileItem, getFileItem, putFileItem } from '../api';
import { FileResponse } from '../api/dataPlaneSchemas';
import { XataPlugin, XataPluginOptions } from '../plugins';
import { ColumnsByValue, XataArrayFile, XataFile } from '../schema';
import { BaseData } from '../schema/record';
import { isBlob } from '../util/lang';
import { GetArrayInnerType, StringKeys, Values } from '../util/types';

export type BinaryFile = string | Blob | ArrayBuffer | XataFile | Promise<XataFile>;

export type FilesPluginResult<Schemas extends Record<string, BaseData>> = {
  download: <Tables extends StringKeys<Schemas>>(location: DownloadDestination<Schemas, Tables>) => Promise<Blob>;
  upload: <Tables extends StringKeys<Schemas>>(
    location: UploadDestination<Schemas, Tables>,
    file: BinaryFile,
    options?: { mediaType?: string }
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

export class FilesPlugin<Schemas extends Record<string, any>> extends XataPlugin {
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
      upload: async (
        location: Record<string, string | undefined>,
        file: BinaryFile,
        options?: { mediaType?: string }
      ) => {
        const { table, record, column, fileId = '' } = location ?? {};
        const resolvedFile = await file;
        const contentType = options?.mediaType || getContentType(resolvedFile);
        const body = resolvedFile instanceof XataFile ? resolvedFile.toBlob() : (resolvedFile as Blob);

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
          body,
          headers: { 'Content-Type': contentType }
        });
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

  // Check for XataFile
  if ('mediaType' in file && file.mediaType !== undefined) {
    return file.mediaType;
  }

  if (isBlob(file)) {
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
