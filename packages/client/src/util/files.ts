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
      // @ts-ignore - File might not be in the type definitions
      const name = file instanceof File ? file.name : undefined;
      const base64Content = await new Promise<string>((resolve, reject) => {
        // @ts-ignore - FileReader might not be in the type definitions
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

// We support: Buffer, Blob, File, XataFile, XataArrayFile
export async function parseExternalFile(file: unknown): Promise<PartialBy<XataFile, 'name' | 'mediaType'> | undefined> {
  if (!isDefined(file)) return undefined;

  if (isObject(file) && isString(file.base64Content)) {
    return file as { base64Content: string; name?: string };
  }

  const bufferFile = parseBuffer(file as Buffer);
  if (bufferFile) return bufferFile;

  const browserBlobFile = await parseBrowserBlobFile(file as Blob | File);
  if (browserBlobFile) return browserBlobFile;

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
