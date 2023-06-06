import { XataFile } from '../schema/record';
import { PartialBy, isDefined, isObject, isString } from './lang';

function parseBuffer(file: Buffer) {
  try {
    if (file instanceof Buffer) {
      return { base64Content: file.toString('base64') };
    }
  } catch (e) {
    // ignore
  }
}

async function parseBrowserBlobFile(file: Blob | File) {
  try {
    if (file instanceof Blob) {
      const name = file instanceof File ? file.name : undefined;
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      return { base64Content, name };
    }
  } catch (e) {
    // ignore
  }
}

async function parseBrowserArrayBuffer(file: ArrayBuffer) {
  try {
    if (file instanceof ArrayBuffer) {
      return parseBrowserBlobFile(new Blob([file]));
    }
  } catch (e) {
    // ignore
  }
}

// We support: Buffer, Blob, File, ArrayBuffer, XataFile, XataArrayFile
export async function parseExternalFile(file: unknown): Promise<PartialBy<XataFile, 'name' | 'mediaType'> | undefined> {
  if (!isDefined(file)) return;

  if (isObject(file) && isString(file.base64Content)) {
    return file as { base64Content: string; name?: string };
  }

  const bufferFile = parseBuffer(file as Buffer);
  if (bufferFile) return bufferFile;

  const browserBlobFile = await parseBrowserBlobFile(file as Blob | File);
  if (browserBlobFile) return browserBlobFile;

  const browserArrayBufferFile = await parseBrowserArrayBuffer(file as ArrayBuffer);
  if (browserArrayBufferFile) return browserArrayBufferFile;
}
