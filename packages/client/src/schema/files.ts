import { InputFileEntry } from '../api/schemas';
import { ImageTransformations, transformImage } from '../files/transformations';
import { compactObject, isDefined } from '../util/lang';
import { StringKeys } from '../util/types';
import { Identifiable, InputXataFile } from './record';

export type XataFileEditableFields = Partial<Pick<XataArrayFile, keyof InputFileEntry>>;
export type XataFileFields = Partial<
  Pick<
    XataArrayFile,
    { [K in StringKeys<XataArrayFile>]: XataArrayFile[K] extends Function ? never : K }[keyof XataArrayFile]
  >
>;

export class XataFile {
  /**
   * Identifier of the file.
   */
  public id?: string;
  /**
   * Name of the file.
   */
  public name?: string;
  /**
   * Media type of the file.
   */
  public mediaType?: string;
  /**
   * Base64 encoded content of the file.
   */
  public base64Content?: string;
  /**
   * Whether to enable public url for the file.
   */
  public enablePublicUrl?: boolean;
  /**
   * Timeout for the signed url in seconds. Default: 60 seconds (1 minute).
   */
  public signedUrlTimeout?: number;
  /**
   * Time to live for upload URLs in seconds. Default: 86400 seconds (24 hours).
   */
  public uploadUrlTimeout?: number;
  /**
   * Size of the file.
   */
  public size?: number;
  /**
   * Version of the file.
   */
  public version?: number;
  /**
   * Url of the file.
   */
  public url?: string;
  /**
   * Signed url of the file (if requested, a temporary signed url will be returned).
   */
  public signedUrl?: string;
  /**
   * Upload url of the file (if requested, a temporary upload url will be returned).
   */
  public uploadUrl?: string;
  /**
   * Attributes of the file.
   */
  public attributes?: Record<string, any>;

  constructor(file: Partial<XataFile>) {
    this.id = file.id;
    this.name = file.name;
    this.mediaType = file.mediaType;
    this.base64Content = file.base64Content;
    this.enablePublicUrl = file.enablePublicUrl;
    this.signedUrlTimeout = file.signedUrlTimeout;
    this.uploadUrlTimeout = file.uploadUrlTimeout;
    this.size = file.size;
    this.version = file.version;
    this.url = file.url;
    this.signedUrl = file.signedUrl;
    this.uploadUrl = file.uploadUrl;
    this.attributes = file.attributes;
  }

  static fromBuffer(buffer: Buffer, options: XataFileEditableFields = {}): XataFile {
    const base64Content = buffer.toString('base64');
    return new XataFile({ ...options, base64Content });
  }

  public toBuffer(): Buffer {
    if (!this.base64Content) {
      throw new Error(`File content is not available, please select property "base64Content" when querying the file`);
    }

    return Buffer.from(this.base64Content, 'base64');
  }

  static fromArrayBuffer(arrayBuffer: ArrayBuffer, options: XataFileEditableFields = {}) {
    const uint8Array = new Uint8Array(arrayBuffer);
    return this.fromUint8Array(uint8Array, options);
  }

  public toArrayBuffer(): ArrayBuffer {
    if (!this.base64Content) {
      throw new Error(`File content is not available, please select property "base64Content" when querying the file`);
    }

    const binary = atob(this.base64Content);
    return new ArrayBuffer(binary.length);
  }

  static fromUint8Array(uint8Array: Uint8Array, options: XataFileEditableFields = {}) {
    let binary = '';

    for (let i = 0; i < uint8Array.byteLength; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }

    const base64Content = btoa(binary);
    return new XataFile({ ...options, base64Content });
  }

  public toUint8Array(): Uint8Array {
    if (!this.base64Content) {
      throw new Error(`File content is not available, please select property "base64Content" when querying the file`);
    }

    const binary = atob(this.base64Content);
    const uint8Array = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      uint8Array[i] = binary.charCodeAt(i);
    }

    return uint8Array;
  }

  static async fromBlob(file: Blob, options: XataFileEditableFields = {}) {
    // @ts-ignore - Blob doesn't have a name property, File which extends Blob does
    const name = options.name ?? file.name;
    const mediaType = file.type;
    const arrayBuffer = await file.arrayBuffer();

    return this.fromArrayBuffer(arrayBuffer, { ...options, name, mediaType });
  }

  public toBlob(): Blob {
    if (!this.base64Content) {
      throw new Error(`File content is not available, please select property "base64Content" when querying the file`);
    }

    const binary = atob(this.base64Content);
    const uint8Array = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      uint8Array[i] = binary.charCodeAt(i);
    }

    return new Blob([uint8Array], { type: this.mediaType });
  }

  static fromString(string: string, options: XataFileEditableFields = {}): XataFile {
    const base64Content = btoa(string);
    return new XataFile({ ...options, base64Content });
  }

  public toString(): string {
    if (!this.base64Content) {
      throw new Error(`File content is not available, please select property "base64Content" when querying the file`);
    }

    return atob(this.base64Content);
  }

  static fromBase64(base64Content: string, options: XataFileEditableFields = {}): XataFile {
    return new XataFile({ ...options, base64Content });
  }

  public toBase64(): string {
    if (!this.base64Content) {
      throw new Error(`File content is not available, please select property "base64Content" when querying the file`);
    }

    return this.base64Content;
  }

  public transform(...options: ImageTransformations[]) {
    return {
      url: transformImage(this.url, ...options),
      signedUrl: transformImage(this.signedUrl, ...options),
      metadataUrl: transformImage(this.url, ...options, { format: 'json' }),
      metadataSignedUrl: transformImage(this.signedUrl, ...options, { format: 'json' })
    };
  }
}

export type XataArrayFile = Identifiable & XataFile;

export const parseInputFileEntry = async (entry: InputXataFile): Promise<InputFileEntry | null> => {
  if (!isDefined(entry)) return null;

  const { id, name, mediaType, base64Content, enablePublicUrl, signedUrlTimeout, uploadUrlTimeout } = await entry;
  return compactObject({
    id,
    // Name cannot be an empty string in our API
    name: name ? name : undefined,
    mediaType,
    base64Content,
    enablePublicUrl,
    signedUrlTimeout,
    uploadUrlTimeout
  });
};
