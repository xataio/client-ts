import { isString } from '../util/lang';
import { Identifiable } from './record';

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

  static async fromBuffer(
    buffer: Buffer,
    { name, mediaType }: { name?: string; mediaType?: string } = {}
  ): Promise<XataFile> {
    const base64Content = buffer.toString('base64');
    return new XataFile({ base64Content, name, mediaType });
  }

  static async fromBlob(file: Blob, options: { name?: string; mediaType?: string } = {}): Promise<XataFile> {
    // @ts-ignore - Blob doesn't have a name property, File which extends Blob does
    const name = options.name ?? file.name;
    const mediaType = file.type;
    const arrayBuffer = await file.arrayBuffer();

    return await this.fromArrayBuffer(arrayBuffer, { name, mediaType });
  }

  static async fromUint8Array(uint8Array: Uint8Array, { name, mediaType }: { name?: string; mediaType?: string } = {}) {
    let binary = '';

    for (let i = 0; i < uint8Array.byteLength; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }

    const base64Content = btoa(binary);
    return new XataFile({ base64Content, name, mediaType });
  }

  static async fromArrayBuffer(
    arrayBuffer: ArrayBuffer,
    { name, mediaType }: { name?: string; mediaType?: string } = {}
  ) {
    const uint8Array = new Uint8Array(arrayBuffer);
    return await this.fromUint8Array(uint8Array, { name, mediaType });
  }
}

export type XataArrayFile = Identifiable & XataFile;
