import { XataFile } from '../schema/record';
import { PartialBy, isDefined, isObject, isString } from './lang';

// To be removed
const defaultMediaType = 'application/octet-stream';

function parseBuffer(file: Buffer) {
  try {
    if (file instanceof Buffer) {
      return { base64Content: file.toString('base64'), mediaType: defaultMediaType };
    }
  } catch (e) {
    // ignore
  }
}

async function parseBrowserBlobFile(file: Blob | File) {
  try {
    if (file instanceof Blob) {
      // @ts-ignore - File might not be in the type definitions
      const name = file instanceof File ? file.name : undefined;
      const mediaType = file.type || defaultMediaType;
      const base64Content = await new Promise<string>((resolve, reject) => {
        // @ts-ignore - FileReader might not be in the type definitions
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (isString(result)) {
            const base64Content = result.split(',')[1];
            resolve(base64Content);
          } else {
            reject(new Error('Failed to read file'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      return { base64Content, name, mediaType };
    }
  } catch (e) {
    // ignore
  }
}

async function parseUint8Array(file: Uint8Array) {
  try {
    if (file instanceof Uint8Array) {
      const decoder = new TextDecoder('utf-8');
      const base64Content = btoa(decoder.decode(file));
      return { base64Content, mediaType: defaultMediaType };
    }
  } catch (e) {
    // ignore
  }
}

function isPartialXataFile(file: unknown): file is PartialBy<XataFile, 'name' | 'mediaType'> {
  if (!isObject(file)) return false;
  if (!isString(file.base64Content)) return false;
  if (isDefined(file.name) && !isString(file.mediaType)) return false;
  if (isDefined(file.name) && !isString(file.name)) return false;

  return true;
}

// We support: Buffer, Blob, File, XataFile, XataArrayFile
export async function parseExternalFile(file: unknown): Promise<PartialBy<XataFile, 'name' | 'mediaType'> | undefined> {
  if (!isDefined(file)) return undefined;
  if (isPartialXataFile(file)) return file;

  const bufferFile = parseBuffer(file as Buffer);
  if (bufferFile) return bufferFile;

  const browserBlobFile = await parseBrowserBlobFile(file as Blob | File);
  if (browserBlobFile) return browserBlobFile;

  const uint8ArrayFile = await parseUint8Array(file as Uint8Array);
  if (uint8ArrayFile) return uint8ArrayFile;

  return undefined;
}

/**
 * Provides information about files and allows JavaScript in a web page to access their content.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/File)
 */
export interface File extends Blob {
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/File/lastModified) */
  readonly lastModified: number;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/File/name) */
  readonly name: string;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/File/webkitRelativePath) */
  readonly webkitRelativePath: string;
}
