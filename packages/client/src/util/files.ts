import { XataFile } from '../schema/record';
import { PartialBy, isDefined, isObject, isString } from './lang';

// To be removed
const defaultMediaType = 'application/octet-stream';

function parseBuffer(file: Buffer) {
  try {
    if (file instanceof Buffer) {
      const base64Content = file.toString('base64');
      return { base64Content, mediaType: defaultMediaType };
    }
  } catch (e) {
    console.log('parseBuffer error', e);
    // ignore
  }
}

async function parseBrowserBlob(file: Blob) {
  try {
    if (file instanceof Blob && FileReader !== undefined) {
      const name = file.name;
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
    console.log('parseBrowserBlobFile error', e);
    // ignore
  }
}

async function parseUint8Array(file: Uint8Array | ArrayBuffer) {
  try {
    const uint8Array = file instanceof ArrayBuffer ? new Uint8Array(file) : file;

    if (uint8Array instanceof Uint8Array) {
      let binary = '';

      for (let i = 0; i < uint8Array.byteLength; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }

      const base64Content = btoa(binary);
      return { base64Content, mediaType: defaultMediaType };
    }
  } catch (e) {
    console.log('parseUint8Array error', e);
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

// We support: Buffer, Blob, File, XataFile, XataArrayFile, string, Uint8Array, ArrayBuffer
export async function parseExternalFile(file: unknown): Promise<PartialBy<XataFile, 'name' | 'mediaType'> | undefined> {
  if (!isDefined(file)) return undefined;
  if (isPartialXataFile(file)) return file;

  const stringFile = isString(file) ? { base64Content: file, mediaType: 'text/plain' } : undefined;
  if (stringFile) return stringFile;

  const bufferFile = parseBuffer(file as Buffer);
  if (bufferFile) return bufferFile;

  const browserBlobFile = await parseBrowserBlob(file as Blob | File);
  if (browserBlobFile) return browserBlobFile;

  const uint8ArrayFile = await parseUint8Array(file as Uint8Array);
  if (uint8ArrayFile) return uint8ArrayFile;

  throw new Error('Unable to parse file');
}
