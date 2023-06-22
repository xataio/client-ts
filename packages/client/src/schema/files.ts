import { InputFileEntry } from '../api/schemas';
import { ImageTransformations, transformImage } from '../files/transformations';
import { compactObject, isDefined } from '../util/lang';
import { Identifiable } from './record';

type XataFileEditableFields = Partial<Pick<XataArrayFile, keyof InputFileEntry>>;

export class XataFile {
  /**
   * Name of this file.
   */
  public name?: string;
  /**
   * Media type of this file.
   */
  public mediaType: string;
  /**
   * Base64 encoded content of this file.
   */
  public base64Content?: string;
  /**
   * Whether to enable public url for this file.
   */
  public enablePublicUrl?: boolean;
  /**
   * Timeout for the signed url.
   */
  public signedUrlTimeout?: number;
  /**
   * Size of this file.
   */
  public size?: number;
  /**
   * Version of this file.
   */
  public version?: number;
  /**
   * Url of this file.
   */
  public url?: string;
  /**
   * Signed url of this file.
   */
  public signedUrl?: string;
  /**
   * Attributes of this file.
   */
  public attributes?: Record<string, unknown>;

  constructor(file: Partial<XataFile>) {
    this.name = file.name;
    this.mediaType = file.mediaType || 'application/octet-stream';
    this.base64Content = file.base64Content;
    this.enablePublicUrl = file.enablePublicUrl;
    this.signedUrlTimeout = file.signedUrlTimeout;
    this.size = file.size;
    this.version = file.version;
    this.url = file.url;
    this.signedUrl = file.signedUrl;
    this.attributes = file.attributes;
  }

  static async fromBuffer(buffer: Buffer, options: XataFileEditableFields = {}): Promise<XataFile> {
    const base64Content = buffer.toString('base64');
    return new XataFile({ ...options, base64Content });
  }

  public toBuffer(): Buffer {
    if (!this.base64Content) {
      throw new Error(`File content is not available, please select property "base64Content" when querying the file`);
    }

    return Buffer.from(this.base64Content, 'base64');
  }

  static async fromArrayBuffer(arrayBuffer: ArrayBuffer, options: XataFileEditableFields = {}) {
    const uint8Array = new Uint8Array(arrayBuffer);
    return await this.fromUint8Array(uint8Array, options);
  }

  public toArrayBuffer(): ArrayBuffer {
    if (!this.base64Content) {
      throw new Error(`File content is not available, please select property "base64Content" when querying the file`);
    }

    const binary = atob(this.base64Content);
    return new ArrayBuffer(binary.length);
  }

  static async fromUint8Array(uint8Array: Uint8Array, options: XataFileEditableFields = {}) {
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

    return await this.fromArrayBuffer(arrayBuffer, { ...options, name, mediaType });
  }

  public toBlob(): Blob {
    if (!this.base64Content) {
      throw new Error(`File content is not available, please select property "base64Content" when querying the file`);
    }

    const arrayBuffer = this.toArrayBuffer();
    // @ts-ignore - Blob and ArrayBuffer might not be type compatible
    return new Blob([arrayBuffer], { type: this.mediaType });
  }

  static async fromString(string: string, options: XataFileEditableFields = {}): Promise<XataFile> {
    const base64Content = btoa(string);
    return new XataFile({ ...options, base64Content });
  }

  public toString(): string {
    if (!this.base64Content) {
      throw new Error(`File content is not available, please select property "base64Content" when querying the file`);
    }

    return atob(this.base64Content);
  }

  static async fromBase64(base64Content: string, options: XataFileEditableFields = {}): Promise<XataFile> {
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
      url: transformImage(this.url, options),
      signedUrl: transformImage(this.signedUrl, options)
    };
  }
}

export type XataArrayFile = Identifiable & XataFile;

export const parseInputFileEntry = (entry: XataFile & Partial<Identifiable>): InputFileEntry | null => {
  if (!isDefined(entry)) return null;

  const { id, name, mediaType, base64Content, enablePublicUrl, signedUrlTimeout } = entry;
  return compactObject({ id, name, mediaType, base64Content, enablePublicUrl, signedUrlTimeout });
};
