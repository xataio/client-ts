import { customType } from 'drizzle-orm/pg-core';

type PgXataFile = {
  enablePublicUrl: boolean;
  mediaType: string;
  name: string;
  signedUrlTimeout: number;
  size: number;
  storageKey: string;
  uploadKey: string;
  uploadUrlTimeout: number;
  version: number;
};

export const xataFile = (name: string) =>
  customType<{ data: PgXataFile; driverData: unknown }>({
    dataType() {
      return 'xata.xata_file';
    },
    toDriver(value: PgXataFile): unknown {
      return value;
    },
    fromDriver(value: unknown): PgXataFile {
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Unable to parse xata file from driver data');
      }

      return value as PgXataFile;
    }
  })(name);

export const xataFileArray = (name: string) =>
  customType<{ data: PgXataFile[]; driverData: unknown }>({
    dataType() {
      return 'xata.xata_file_array';
    },
    toDriver(value: PgXataFile[]): unknown {
      return value;
    },
    fromDriver(value: unknown): PgXataFile[] {
      if (typeof value !== 'object' || !Array.isArray(value)) {
        throw new Error('Unable to parse xata file array from driver data');
      }

      return value as PgXataFile[];
    }
  })(name);
