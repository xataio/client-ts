/* eslint-disable no-class-assign, prefer-rest-params, prefer-spread */

import * as base64 from './base64';

export const K_MAX_LENGTH = 0x7fffffff;
export const MAX_ARGUMENTS_LENGTH = 4096;

class Buffer extends Uint8Array {
  /**
   * Allocates a new buffer containing the given `str`.
   *
   * @param str String to store in buffer.
   * @param encoding Encoding to use, optional. Default is `utf8`.
   */
  protected constructor(str: string, encoding?: Encoding);

  /**
   * Allocates a new buffer of `size` octets.
   *
   * @param size Count of octets to allocate.
   */
  protected constructor(size: number);

  /**
   * Allocates a new buffer containing the given `array` of octets.
   *
   * @param array The octets to store.
   */
  protected constructor(array: Uint8Array);

  /**
   * Allocates a new buffer containing the given `array` of octet values.
   *
   * @param array
   */
  protected constructor(array: number[]);

  /**
   * Copies the passed `buffer` data onto a new `Buffer` instance.
   *
   * @param buffer
   */
  protected constructor(buffer: Buffer);

  /**
   * When passed a reference to the .buffer property of a TypedArray instance, the newly created Buffer will share
   * the same allocated memory as the TypedArray. The optional `byteOffset` and `length` arguments specify a memory
   * range within the `arrayBuffer` that will be shared by the Buffer.
   *
   * @param buffer The .buffer property of a TypedArray or a new ArrayBuffer().
   * @param byteOffset
   * @param length
   */
  protected constructor(buffer: ArrayBuffer, byteOffset?: number, length?: number);

  /**
   * Constructs a new `Buffer` instance.
   *
   * @param value
   * @param encodingOrOffset
   * @param length
   */
  protected constructor(
    value: string | number | Uint8Array | ArrayBuffer | number[] | Buffer,
    encodingOrOffset?: Encoding | number,
    length?: number
  ) {
    // Handle numbers
    if (typeof value === 'number') {
      // If the value is a number but an encoding was provided, there's a mistake -- throw an error
      if (typeof encodingOrOffset === 'string') {
        throw new TypeError('The first argument must be of type string, received type number');
      }

      // Make sure it's positive!!
      if (value < 0) {
        throw new RangeError('The buffer size cannot be negative');
      }

      super(value < 0 ? 0 : Buffer._checked(value) | 0);
    }

    // Handle strings
    else if (typeof value === 'string') {
      if (typeof encodingOrOffset !== 'string') {
        encodingOrOffset = 'utf8';
      }

      if (!Buffer.isEncoding(encodingOrOffset)) {
        throw new TypeError('Unknown encoding: ' + encodingOrOffset);
      }

      // Create the internal buffer
      const length = Buffer.byteLength(value, encodingOrOffset) | 0;
      super(length);

      // Write the data
      // We'll also make sure the expected number of bytes was written
      // If not, something is wrong somewhere, and instead of ignoring it we should error!
      const written = this.write(value, 0, this.length, encodingOrOffset);

      if (written !== length) {
        throw new TypeError(
          'Number of bytes written did not match expected length (wrote ' + written + ', expected ' + length + ')'
        );
      }
    }

    // Handle views
    else if (ArrayBuffer.isView(value)) {
      // Create from a direct view
      if (Buffer._isInstance(value, Uint8Array)) {
        const copy = new Uint8Array(value);
        const array = copy.buffer;
        const byteOffset = copy.byteOffset;
        const length = copy.byteLength;

        if (byteOffset < 0 || array.byteLength < byteOffset) {
          throw new RangeError('offset is outside of buffer bounds');
        }

        if (array.byteLength < byteOffset + (length || 0)) {
          throw new RangeError('length is outside of buffer bounds');
        }

        // Create from the array buffer
        super(new Uint8Array(array, byteOffset, length));
      }

      // Create from an array like
      else {
        const array = value as ArrayLike<number>;
        const length = array.length < 0 ? 0 : Buffer._checked(array.length) | 0;

        // Create the buffer
        super(new Uint8Array(length));

        // Allocate the bytes manually
        for (let i = 0; i < length; i++) {
          this[i] = array[i] & 255;
        }
      }
    }

    // Handle falsey values
    else if (value == null) {
      throw new TypeError(
        'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
          'or Array-like Object. Received type ' +
          typeof value
      );
    }

    // Handle array buffers
    else if (
      Buffer._isInstance(value, ArrayBuffer) ||
      (value && Buffer._isInstance((value as any).buffer, ArrayBuffer))
    ) {
      const array = value as Uint8Array;
      const byteOffset = encodingOrOffset as number;

      if (byteOffset < 0 || array.byteLength < byteOffset) {
        throw new RangeError('offset is outside of buffer bounds');
      }

      if (array.byteLength < byteOffset + (length || 0)) {
        throw new RangeError('length is outside of buffer bounds');
      }

      // Create from the array buffer
      super(new Uint8Array(array, byteOffset, length));
    }

    // Handle arrays
    else if (Array.isArray(value)) {
      const array = value as ArrayLike<number>;
      const length = array.length < 0 ? 0 : Buffer._checked(array.length) | 0;

      // Create the buffer
      super(new Uint8Array(length));

      // Allocate the bytes manually
      for (let i = 0; i < length; i++) {
        this[i] = array[i] & 255;
      }
    }

    // Throw an error for anything else
    else {
      throw new TypeError('Unable to determine the correct way to allocate buffer for type ' + typeof value);
    }
  }

  /**
   * Writes `string` to the buffer at `offset` according to the character encoding in `encoding`. The `length`
   * parameter is the number of bytes to write. If the buffer does not contain enough space to fit the entire string,
   * only part of `string` will be written. However, partially encoded characters will not be written.
   *
   * @param string String to write to `buf`.
   * @param offset Number of bytes to skip before starting to write `string`. Default: `0`.
   * @param length Maximum number of bytes to write: Default: `buf.length - offset`.
   * @param encoding The character encoding of `string`. Default: `utf8`.
   */
  public write(string: string, offset?: number, length?: number, encoding?: Encoding): number {
    if (typeof offset === 'undefined') {
      encoding = 'utf8';
      length = this.length;
      offset = 0;
    } else if (typeof length === 'undefined' && typeof offset === 'string') {
      encoding = offset;
      length = this.length;
      offset = 0;
    } else if (typeof offset === 'number' && isFinite(offset)) {
      offset = offset >>> 0;

      if (typeof length === 'number' && isFinite(length)) {
        length = length >>> 0;
        encoding ??= 'utf8';
      } else if (typeof length === 'string') {
        encoding = length;
        length = undefined;
      }
      // else {
      // 	throw new TypeError('Error forming arguments');
      // }
    } else {
      throw new Error('Buffer.write(string, encoding, offset[, length]) is no longer supported');
    }

    const remaining = this.length - offset;

    if (typeof length === 'undefined' || length > remaining) {
      length = remaining;
    }

    if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
      throw new RangeError('Attempt to write outside buffer bounds');
    }

    // Default encoding to utf8
    encoding ||= 'utf8';

    switch (Buffer._getEncoding(encoding)) {
      case 'hex':
        return Buffer._hexWrite(this, string, offset, length);

      case 'utf8':
        return Buffer._utf8Write(this, string, offset, length);

      case 'ascii':
      case 'latin1':
      case 'binary':
        return Buffer._asciiWrite(this, string, offset, length);

      case 'ucs2':
      case 'utf16le':
        return Buffer._ucs2Write(this, string, offset, length);

      case 'base64':
        return Buffer._base64Write(this, string, offset, length);
    }
  }

  /**
   * Decodes the buffer to a string according to the specified character encoding.
   * Passing `start` and `end` will decode only a subset of the buffer.
   *
   * Note that if the encoding is `utf8` and a byte sequence in the input is not valid UTF-8, then each invalid byte
   * will be replaced with `U+FFFD`.
   *
   * @param encoding
   * @param start
   * @param end
   */
  public toString(encoding?: Encoding, start?: number, end?: number): string {
    const length = this.length;

    if (length === 0) {
      return '';
    }

    if (arguments.length === 0) {
      return Buffer._utf8Slice(this, 0, length);
    }

    if (typeof start === 'undefined' || start < 0) {
      start = 0;
    }

    if (start > this.length) {
      return '';
    }

    if (typeof end === 'undefined' || end > this.length) {
      end = this.length;
    }

    if (end <= 0) {
      return '';
    }

    // Force coercion to uint32, this will also convert falsey valves to 0
    end >>>= 0;
    start >>>= 0;

    if (end <= start) {
      return '';
    }

    if (!encoding) {
      encoding = 'utf8';
    }

    switch (Buffer._getEncoding(encoding)) {
      case 'hex':
        return Buffer._hexSlice(this, start, end);

      case 'utf8':
        return Buffer._utf8Slice(this, start, end);

      case 'ascii':
        return Buffer._asciiSlice(this, start, end);

      case 'latin1':
      case 'binary':
        return Buffer._latin1Slice(this, start, end);

      case 'ucs2':
      case 'utf16le':
        return Buffer._utf16leSlice(this, start, end);

      case 'base64':
        return Buffer._base64Slice(this, start, end);
    }
  }

  /**
   * Returns true if this buffer's is equal to the provided buffer, meaning they share the same exact data.
   *
   * @param otherBuffer
   */
  public equals(otherBuffer: Buffer): boolean {
    if (!Buffer.isBuffer(otherBuffer)) {
      throw new TypeError('Argument must be a Buffer');
    }

    if (this === otherBuffer) {
      return true;
    }

    return Buffer.compare(this, otherBuffer) === 0;
  }

  /**
   * Compares the buffer with `otherBuffer` and returns a number indicating whether the buffer comes before, after,
   * or is the same as `otherBuffer` in sort order. Comparison is based on the actual sequence of bytes in each
   * buffer.
   *
   * - `0` is returned if `otherBuffer` is the same as this buffer.
   * - `1` is returned if `otherBuffer` should come before this buffer when sorted.
   * - `-1` is returned if `otherBuffer` should come after this buffer when sorted.
   *
   * @param otherBuffer The buffer to compare to.
   * @param targetStart The offset within `otherBuffer` at which to begin comparison.
   * @param targetEnd The offset within `otherBuffer` at which to end comparison (exclusive).
   * @param sourceStart The offset within this buffer at which to begin comparison.
   * @param sourceEnd The offset within this buffer at which to end the comparison (exclusive).
   */
  public compare(
    otherBuffer: Uint8Array,
    targetStart?: number,
    targetEnd?: number,
    sourceStart?: number,
    sourceEnd?: number
  ): number {
    if (Buffer._isInstance(otherBuffer, Uint8Array)) {
      otherBuffer = Buffer.from(otherBuffer, otherBuffer.byteOffset, otherBuffer.byteLength);
    }

    if (!Buffer.isBuffer(otherBuffer)) {
      throw new TypeError('Argument must be a Buffer or Uint8Array');
    }

    targetStart ??= 0;
    targetEnd ??= otherBuffer ? otherBuffer.length : 0;
    sourceStart ??= 0;
    sourceEnd ??= this.length;

    if (targetStart < 0 || targetEnd > otherBuffer.length || sourceStart < 0 || sourceEnd > this.length) {
      throw new RangeError('Out of range index');
    }

    if (sourceStart >= sourceEnd && targetStart >= targetEnd) {
      return 0;
    }

    if (sourceStart >= sourceEnd) {
      return -1;
    }

    if (targetStart >= targetEnd) {
      return 1;
    }

    targetStart >>>= 0;
    targetEnd >>>= 0;
    sourceStart >>>= 0;
    sourceEnd >>>= 0;

    if (this === otherBuffer) {
      return 0;
    }

    let x = sourceEnd - sourceStart;
    let y = targetEnd - targetStart;
    const len = Math.min(x, y);

    const thisCopy = this.slice(sourceStart, sourceEnd);
    const targetCopy = otherBuffer.slice(targetStart, targetEnd);

    for (let i = 0; i < len; ++i) {
      if (thisCopy[i] !== targetCopy[i]) {
        x = thisCopy[i];
        y = targetCopy[i];

        break;
      }
    }

    if (x < y) return -1;
    if (y < x) return 1;

    return 0;
  }

  /**
   * Copies data from a region of this buffer to a region in `targetBuffer`, even if the `targetBuffer` memory
   * region overlaps with this buffer.
   *
   * @param targetBuffer The target buffer to copy into.
   * @param targetStart The offset within `targetBuffer` at which to begin writing.
   * @param sourceStart The offset within this buffer at which to begin copying.
   * @param sourceEnd The offset within this buffer at which to end copying (exclusive).
   */
  public copy(targetBuffer: Uint8Array, targetStart?: number, sourceStart?: number, sourceEnd?: number): number {
    if (!Buffer.isBuffer(targetBuffer)) throw new TypeError('argument should be a Buffer');
    if (!sourceStart) sourceStart = 0;
    if (!targetStart) targetStart = 0;
    if (!sourceEnd && sourceEnd !== 0) sourceEnd = this.length;
    if (targetStart >= targetBuffer.length) targetStart = targetBuffer.length;
    if (!targetStart) targetStart = 0;
    if (sourceEnd > 0 && sourceEnd < sourceStart) sourceEnd = sourceStart;

    // Copy 0 bytes; we're done
    if (sourceEnd === sourceStart) return 0;
    if (targetBuffer.length === 0 || this.length === 0) return 0;

    // Fatal error conditions
    if (targetStart < 0) {
      throw new RangeError('targetStart out of bounds');
    }

    if (sourceStart < 0 || sourceStart >= this.length) throw new RangeError('Index out of range');
    if (sourceEnd < 0) throw new RangeError('sourceEnd out of bounds');

    // Are we oob?
    if (sourceEnd > this.length) sourceEnd = this.length;
    if (targetBuffer.length - targetStart < sourceEnd - sourceStart) {
      sourceEnd = targetBuffer.length - targetStart + sourceStart;
    }

    const len = sourceEnd - sourceStart;

    if (this === targetBuffer && typeof Uint8Array.prototype.copyWithin === 'function') {
      // Use built-in when available, missing from IE11
      this.copyWithin(targetStart, sourceStart, sourceEnd);
    } else {
      Uint8Array.prototype.set.call(targetBuffer, this.subarray(sourceStart, sourceEnd), targetStart);
    }

    return len;
  }

  /**
   * Returns a new `Buffer` that references the same memory as the original, but offset and cropped by the `start`
   * and `end` indices. This is the same behavior as `buf.subarray()`.
   *
   * This method is not compatible with the `Uint8Array.prototype.slice()`, which is a superclass of Buffer. To copy
   * the slice, use `Uint8Array.prototype.slice()`.
   *
   * @param start
   * @param end
   */
  public slice(start?: number, end?: number): Buffer {
    if (!start) {
      start = 0;
    }

    const len = this.length;
    start = ~~start;
    end = end === undefined ? len : ~~end;

    if (start < 0) {
      start += len;

      if (start < 0) {
        start = 0;
      }
    } else if (start > len) {
      start = len;
    }

    if (end < 0) {
      end += len;

      if (end < 0) {
        end = 0;
      }
    } else if (end > len) {
      end = len;
    }

    if (end < start) {
      end = start;
    }

    const newBuf = this.subarray(start, end);

    // Return an augmented `Uint8Array` instance
    Object.setPrototypeOf(newBuf, Buffer.prototype);

    return newBuf as Buffer;
  }

  /**
   * Writes `byteLength` bytes of `value` to `buf` at the specified `offset` as little-endian. Supports up to 48 bits
   * of accuracy. Behavior is undefined when value is anything other than an unsigned integer.
   *
   * @param value Number to write.
   * @param offset Number of bytes to skip before starting to write.
   * @param byteLength Number of bytes to write, between 0 and 6.
   * @param noAssert
   * @returns `offset` plus the number of bytes written.
   */
  public writeUIntLE(value: number, offset: number, byteLength: number, noAssert?: boolean): number {
    value = +value;
    offset = offset >>> 0;
    byteLength = byteLength >>> 0;

    if (!noAssert) {
      const maxBytes = Math.pow(2, 8 * byteLength) - 1;
      Buffer._checkInt(this, value, offset, byteLength, maxBytes, 0);
    }

    let mul = 1;
    let i = 0;

    this[offset] = value & 0xff;

    while (++i < byteLength && (mul *= 0x100)) {
      this[offset + i] = (value / mul) & 0xff;
    }

    return offset + byteLength;
  }

  /**
   * Writes `byteLength` bytes of `value` to `buf` at the specified `offset` as big-endian. Supports up to 48 bits of
   * accuracy. Behavior is undefined when `value` is anything other than an unsigned integer.
   *
   * @param value Number to write.
   * @param offset Number of bytes to skip before starting to write.
   * @param byteLength Number of bytes to write, between 0 and 6.
   * @param noAssert
   * @returns `offset` plus the number of bytes written.
   */
  public writeUIntBE(value: number, offset: number, byteLength: number, noAssert?: boolean): number {
    value = +value;
    offset = offset >>> 0;
    byteLength = byteLength >>> 0;

    if (!noAssert) {
      const maxBytes = Math.pow(2, 8 * byteLength) - 1;
      Buffer._checkInt(this, value, offset, byteLength, maxBytes, 0);
    }

    let i = byteLength - 1;
    let mul = 1;

    this[offset + i] = value & 0xff;

    while (--i >= 0 && (mul *= 0x100)) {
      this[offset + i] = (value / mul) & 0xff;
    }

    return offset + byteLength;
  }

  /**
   * Writes `byteLength` bytes of `value` to `buf` at the specified `offset` as little-endian. Supports up to 48 bits
   * of accuracy. Behavior is undefined when `value` is anything other than a signed integer.
   *
   * @param value Number to write.
   * @param offset Number of bytes to skip before starting to write.
   * @param byteLength Number of bytes to write, between 0 and 6.
   * @param noAssert
   * @returns `offset` plus the number of bytes written.
   */
  public writeIntLE(value: number, offset: number, byteLength: number, noAssert?: boolean): number {
    value = +value;
    offset = offset >>> 0;

    if (!noAssert) {
      const limit = Math.pow(2, 8 * byteLength - 1);
      Buffer._checkInt(this, value, offset, byteLength, limit - 1, -limit);
    }

    let i = 0;
    let mul = 1;
    let sub = 0;

    this[offset] = value & 0xff;

    while (++i < byteLength && (mul *= 0x100)) {
      if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
        sub = 1;
      }

      this[offset + i] = (((value / mul) >> 0) - sub) & 0xff;
    }

    return offset + byteLength;
  }

  /**
   * Writes `byteLength` bytes of `value` to `buf` at the specified `offset` as big-endian. Supports up to 48 bits
   * of accuracy. Behavior is undefined when `value` is anything other than a signed integer.
   *
   * @param value Number to write.
   * @param offset Number of bytes to skip before starting to write.
   * @param byteLength Number of bytes to write, between 0 and 6.
   * @param noAssert
   * @returns `offset` plus the number of bytes written.
   */
  public writeIntBE(value: number, offset: number, byteLength: number, noAssert?: boolean): number {
    value = +value;
    offset = offset >>> 0;

    if (!noAssert) {
      const limit = Math.pow(2, 8 * byteLength - 1);
      Buffer._checkInt(this, value, offset, byteLength, limit - 1, -limit);
    }

    let i = byteLength - 1;
    let mul = 1;
    let sub = 0;

    this[offset + i] = value & 0xff;

    while (--i >= 0 && (mul *= 0x100)) {
      if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
        sub = 1;
      }

      this[offset + i] = (((value / mul) >> 0) - sub) & 0xff;
    }

    return offset + byteLength;
  }

  /**
   * Reads `byteLength` number of bytes from `buf` at the specified `offset` and interprets the result as an
   * unsigned, little-endian integer supporting up to 48 bits of accuracy.
   *
   * @param offset Number of bytes to skip before starting to read.
   * @param byteLength Number of bytes to read, between 0 and 6.
   * @param noAssert
   */
  public readUIntLE(offset: number, byteLength: number, noAssert?: boolean): number {
    offset = offset >>> 0;
    byteLength = byteLength >>> 0;

    if (!noAssert) {
      Buffer._checkOffset(offset, byteLength, this.length);
    }

    let val = this[offset];
    let mul = 1;
    let i = 0;

    while (++i < byteLength && (mul *= 0x100)) {
      val += this[offset + i] * mul;
    }

    return val;
  }

  /**
   * Reads `byteLength` number of bytes from `buf` at the specified `offset` and interprets the result as an
   * unsigned, big-endian integer supporting up to 48 bits of accuracy.
   *
   * @param offset Number of bytes to skip before starting to read.
   * @param byteLength Number of bytes to read, between 0 and 6.
   * @param noAssert
   */
  public readUIntBE(offset: number, byteLength: number, noAssert?: boolean): number {
    offset = offset >>> 0;
    byteLength = byteLength >>> 0;

    if (!noAssert) {
      Buffer._checkOffset(offset, byteLength, this.length);
    }

    let val = this[offset + --byteLength];
    let mul = 1;

    while (byteLength > 0 && (mul *= 0x100)) {
      val += this[offset + --byteLength] * mul;
    }

    return val;
  }

  /**
   * Reads `byteLength` number of bytes from `buf` at the specified `offset` and interprets the result as a
   * little-endian, two's complement signed value supporting up to 48 bits of accuracy.
   *
   * @param offset Number of bytes to skip before starting to read.
   * @param byteLength Number of bytes to read, between 0 and 6.
   * @param noAssert
   */
  public readIntLE(offset: number, byteLength: number, noAssert?: boolean): number {
    offset = offset >>> 0;
    byteLength = byteLength >>> 0;

    if (!noAssert) {
      Buffer._checkOffset(offset, byteLength, this.length);
    }

    let val = this[offset];
    let mul = 1;
    let i = 0;

    while (++i < byteLength && (mul *= 0x100)) {
      val += this[offset + i] * mul;
    }

    mul *= 0x80;

    if (val >= mul) {
      val -= Math.pow(2, 8 * byteLength);
    }

    return val;
  }

  /**
   * Reads `byteLength` number of bytes from `buf` at the specified `offset` and interprets the result as a
   * big-endian, two's complement signed value supporting up to 48 bits of accuracy.
   *
   * @param offset Number of bytes to skip before starting to read.
   * @param byteLength Number of bytes to read, between 0 and 6.
   * @param noAssert
   */
  public readIntBE(offset: number, byteLength: number, noAssert?: boolean): number {
    offset = offset >>> 0;
    byteLength = byteLength >>> 0;

    if (!noAssert) {
      Buffer._checkOffset(offset, byteLength, this.length);
    }

    let i = byteLength;
    let mul = 1;
    let val = this[offset + --i];

    while (i > 0 && (mul *= 0x100)) {
      val += this[offset + --i] * mul;
    }

    mul *= 0x80;

    if (val >= mul) {
      val -= Math.pow(2, 8 * byteLength);
    }

    return val;
  }

  /**
   * Reads an unsigned 8-bit integer from `buf` at the specified `offset`.
   *
   * @param offset Number of bytes to skip before starting to read.
   * @param noAssert
   */
  public readUInt8(offset: number, noAssert?: boolean): number {
    offset = offset >>> 0;

    if (!noAssert) {
      Buffer._checkOffset(offset, 1, this.length);
    }

    return this[offset];
  }

  /**
   * Reads an unsigned, little-endian 16-bit integer from `buf` at the specified `offset`.
   *
   * @param offset Number of bytes to skip before starting to read.
   * @param noAssert
   */
  public readUInt16LE(offset: number, noAssert?: boolean): number {
    offset = offset >>> 0;

    if (!noAssert) {
      Buffer._checkOffset(offset, 2, this.length);
    }

    return this[offset] | (this[offset + 1] << 8);
  }

  /**
   * Reads an unsigned, big-endian 16-bit integer from `buf` at the specified `offset`.
   *
   * @param offset Number of bytes to skip before starting to read.
   * @param noAssert
   */
  public readUInt16BE(offset: number, noAssert?: boolean): number {
    offset = offset >>> 0;

    if (!noAssert) {
      Buffer._checkOffset(offset, 2, this.length);
    }

    return (this[offset] << 8) | this[offset + 1];
  }

  /**
   * Reads an unsigned, little-endian 32-bit integer from `buf` at the specified `offset`.
   *
   * @param offset Number of bytes to skip before starting to read.
   * @param noAssert
   */
  public readUInt32LE(offset: number, noAssert?: boolean): number {
    offset = offset >>> 0;

    if (!noAssert) {
      Buffer._checkOffset(offset, 4, this.length);
    }

    return (this[offset] | (this[offset + 1] << 8) | (this[offset + 2] << 16)) + this[offset + 3] * 0x1000000;
  }

  /**
   * Reads an unsigned, big-endian 32-bit integer from `buf` at the specified `offset`.
   *
   * @param offset Number of bytes to skip before starting to read.
   * @param noAssert
   */
  public readUInt32BE(offset: number, noAssert?: boolean): number {
    offset = offset >>> 0;

    if (!noAssert) {
      Buffer._checkOffset(offset, 4, this.length);
    }

    return this[offset] * 0x1000000 + ((this[offset + 1] << 16) | (this[offset + 2] << 8) | this[offset + 3]);
  }

  /**
   * Reads a signed 8-bit integer from `buf` at the specified `offset`. Integers read from a `Buffer` are interpreted
   * as two's complement signed values.
   *
   * @param offset Number of bytes to skip before starting to read.
   * @param noAssert
   */
  public readInt8(offset: number, noAssert?: boolean): number {
    offset = offset >>> 0;

    if (!noAssert) {
      Buffer._checkOffset(offset, 1, this.length);
    }

    if (!(this[offset] & 0x80)) {
      return this[offset];
    }

    return (0xff - this[offset] + 1) * -1;
  }

  /**
   * Reads a signed, little-endian 16-bit integer from `buf` at the specified `offset`. Integers read from a `Buffer`
   * are interpreted as two's complement signed values.
   *
   * @param offset Number of bytes to skip before starting to read.
   * @param noAssert
   */
  public readInt16LE(offset: number, noAssert?: boolean): number {
    offset = offset >>> 0;

    if (!noAssert) {
      Buffer._checkOffset(offset, 2, this.length);
    }

    const val = this[offset] | (this[offset + 1] << 8);
    return val & 0x8000 ? val | 0xffff0000 : val;
  }

  /**
   * Reads a signed, big-endian 16-bit integer from `buf` at the specified `offset`. Integers read from a `Buffer`
   * are interpreted as two's complement signed values.
   *
   * @param offset Number of bytes to skip before starting to read.
   * @param noAssert
   */
  public readInt16BE(offset: number, noAssert?: boolean): number {
    offset = offset >>> 0;

    if (!noAssert) {
      Buffer._checkOffset(offset, 2, this.length);
    }

    const val = this[offset + 1] | (this[offset] << 8);
    return val & 0x8000 ? val | 0xffff0000 : val;
  }

  /**
   * Reads a signed, little-endian 32-bit integer from `buf` at the specified `offset`. Integers read from a `Buffer`
   * are interpreted as two's complement signed values.
   *
   * @param offset Number of bytes to skip before starting to read.
   * @param noAssert
   */
  public readInt32LE(offset: number, noAssert?: boolean): number {
    offset = offset >>> 0;

    if (!noAssert) {
      Buffer._checkOffset(offset, 4, this.length);
    }

    return this[offset] | (this[offset + 1] << 8) | (this[offset + 2] << 16) | (this[offset + 3] << 24);
  }

  /**
   * Reads a signed, big-endian 32-bit integer from `buf` at the specified `offset`. Integers read from a `Buffer`
   * are interpreted as two's complement signed values.
   *
   * @param offset Number of bytes to skip before starting to read.
   * @param noAssert
   */
  public readInt32BE(offset: number, noAssert?: boolean): number {
    offset = offset >>> 0;

    if (!noAssert) {
      Buffer._checkOffset(offset, 4, this.length);
    }

    return (this[offset] << 24) | (this[offset + 1] << 16) | (this[offset + 2] << 8) | this[offset + 3];
  }

  /**
   * Interprets `buf` as an array of unsigned 16-bit integers and swaps the byte order in-place.
   * Throws a `RangeError` if `buf.length` is not a multiple of 2.
   */
  public swap16(): Buffer {
    const len = this.length;

    if (len % 2 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 16-bits');
    }

    for (let i = 0; i < len; i += 2) {
      this._swap(this, i, i + 1);
    }

    return this;
  }

  /**
   * Interprets `buf` as an array of unsigned 32-bit integers and swaps the byte order in-place.
   * Throws a `RangeError` if `buf.length` is not a multiple of 4.
   */
  public swap32(): Buffer {
    const len = this.length;

    if (len % 4 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 32-bits');
    }

    for (let i = 0; i < len; i += 4) {
      this._swap(this, i, i + 3);
      this._swap(this, i + 1, i + 2);
    }

    return this;
  }

  /**
   * Interprets `buf` as an array of unsigned 64-bit integers and swaps the byte order in-place.
   * Throws a `RangeError` if `buf.length` is not a multiple of 8.
   */
  public swap64(): Buffer {
    const len = this.length;

    if (len % 8 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 64-bits');
    }

    for (let i = 0; i < len; i += 8) {
      this._swap(this, i, i + 7);
      this._swap(this, i + 1, i + 6);
      this._swap(this, i + 2, i + 5);
      this._swap(this, i + 3, i + 4);
    }

    return this;
  }

  /**
   * Swaps two octets.
   *
   * @param b
   * @param n
   * @param m
   */
  private _swap(b: Buffer, n: number, m: number) {
    const i = b[n];
    b[n] = b[m];
    b[m] = i;
  }

  /**
   * Writes `value` to `buf` at the specified `offset`. The `value` must be a valid unsigned 8-bit integer.
   * Behavior is undefined when `value` is anything other than an unsigned 8-bit integer.
   *
   * @param value Number to write.
   * @param offset Number of bytes to skip before starting to write.
   * @param noAssert
   * @returns `offset` plus the number of bytes written.
   */
  public writeUInt8(value: number, offset: number, noAssert?: boolean): number {
    value = +value;
    offset = offset >>> 0;

    if (!noAssert) {
      Buffer._checkInt(this, value, offset, 1, 0xff, 0);
    }

    this[offset] = value & 0xff;
    return offset + 1;
  }

  /**
   * Writes `value` to `buf` at the specified `offset` as little-endian. The `value` must be a valid unsigned 16-bit
   * integer. Behavior is undefined when `value` is anything other than an unsigned 16-bit integer.
   *
   * @param value Number to write.
   * @param offset Number of bytes to skip before starting to write.
   * @param noAssert
   * @returns `offset` plus the number of bytes written.
   */
  public writeUInt16LE(value: number, offset: number, noAssert?: boolean): number {
    value = +value;
    offset = offset >>> 0;

    if (!noAssert) {
      Buffer._checkInt(this, value, offset, 2, 0xffff, 0);
    }

    this[offset] = value & 0xff;
    this[offset + 1] = value >>> 8;
    return offset + 2;
  }

  /**
   * Writes `value` to `buf` at the specified `offset` as big-endian. The `value` must be a valid unsigned 16-bit
   * integer. Behavior is undefined when `value` is anything other than an unsigned 16-bit integer.
   *
   * @param value Number to write.
   * @param offset Number of bytes to skip before starting to write.
   * @param noAssert
   * @returns `offset` plus the number of bytes written.
   */
  public writeUInt16BE(value: number, offset: number, noAssert?: boolean): number {
    value = +value;
    offset = offset >>> 0;

    if (!noAssert) {
      Buffer._checkInt(this, value, offset, 2, 0xffff, 0);
    }

    this[offset] = value >>> 8;
    this[offset + 1] = value & 0xff;

    return offset + 2;
  }

  /**
   * Writes `value` to `buf` at the specified `offset` as little-endian. The `value` must be a valid unsigned 32-bit
   * integer. Behavior is undefined when `value` is anything other than an unsigned 32-bit integer.
   *
   * @param value Number to write.
   * @param offset Number of bytes to skip before starting to write.
   * @param noAssert
   * @returns `offset` plus the number of bytes written.
   */
  public writeUInt32LE(value: number, offset: number, noAssert?: boolean): number {
    value = +value;
    offset = offset >>> 0;

    if (!noAssert) {
      Buffer._checkInt(this, value, offset, 4, 0xffffffff, 0);
    }

    this[offset + 3] = value >>> 24;
    this[offset + 2] = value >>> 16;
    this[offset + 1] = value >>> 8;
    this[offset] = value & 0xff;
    return offset + 4;
  }

  /**
   * Writes `value` to `buf` at the specified `offset` as big-endian. The `value` must be a valid unsigned 32-bit
   * integer. Behavior is undefined when `value` is anything other than an unsigned 32-bit integer.
   *
   * @param value Number to write.
   * @param offset Number of bytes to skip before starting to write.
   * @param noAssert
   * @returns `offset` plus the number of bytes written.
   */
  public writeUInt32BE(value: number, offset: number, noAssert?: boolean): number {
    value = +value;
    offset = offset >>> 0;

    if (!noAssert) {
      Buffer._checkInt(this, value, offset, 4, 0xffffffff, 0);
    }

    this[offset] = value >>> 24;
    this[offset + 1] = value >>> 16;
    this[offset + 2] = value >>> 8;
    this[offset + 3] = value & 0xff;

    return offset + 4;
  }

  /**
   * Writes `value` to `buf` at the specified `offset`. The `value` must be a valid signed 8-bit integer.
   * Behavior is undefined when `value` is anything other than a signed 8-bit integer.
   *
   * @param value Number to write.
   * @param offset Number of bytes to skip before starting to write.
   * @param noAssert
   * @returns `offset` plus the number of bytes written.
   */
  public writeInt8(value: number, offset: number, noAssert?: boolean): number {
    value = +value;
    offset = offset >>> 0;

    if (!noAssert) {
      Buffer._checkInt(this, value, offset, 1, 0x7f, -0x80);
    }

    if (value < 0) {
      value = 0xff + value + 1;
    }

    this[offset] = value & 0xff;
    return offset + 1;
  }

  /**
   * Writes `value` to `buf` at the specified `offset` as little-endian. The `value` must be a valid signed 16-bit
   * integer. Behavior is undefined when `value` is anything other than a signed 16-bit integer.
   *
   * @param value Number to write.
   * @param offset Number of bytes to skip before starting to write.
   * @param noAssert
   * @returns `offset` plus the number of bytes written.
   */
  public writeInt16LE(value: number, offset: number, noAssert?: boolean): number {
    value = +value;
    offset = offset >>> 0;

    if (!noAssert) {
      Buffer._checkInt(this, value, offset, 2, 0x7fff, -0x8000);
    }

    this[offset] = value & 0xff;
    this[offset + 1] = value >>> 8;

    return offset + 2;
  }

  /**
   * Writes `value` to `buf` at the specified `offset` as big-endian. The `value` must be a valid signed 16-bit
   * integer. Behavior is undefined when `value` is anything other than a signed 16-bit integer.
   *
   * @param value Number to write.
   * @param offset Number of bytes to skip before starting to write.
   * @param noAssert
   * @returns `offset` plus the number of bytes written.
   */
  public writeInt16BE(value: number, offset: number, noAssert?: boolean): number {
    value = +value;
    offset = offset >>> 0;

    if (!noAssert) {
      Buffer._checkInt(this, value, offset, 2, 0x7fff, -0x8000);
    }

    this[offset] = value >>> 8;
    this[offset + 1] = value & 0xff;

    return offset + 2;
  }

  /**
   * Writes `value` to `buf` at the specified `offset` as little-endian. The `value` must be a valid signed 32-bit
   * integer. Behavior is undefined when `value` is anything other than a signed 32-bit integer.
   *
   * @param value Number to write.
   * @param offset Number of bytes to skip before starting to write.
   * @param noAssert
   * @returns `offset` plus the number of bytes written.
   */
  public writeInt32LE(value: number, offset: number, noAssert?: boolean): number {
    value = +value;
    offset = offset >>> 0;

    if (!noAssert) {
      Buffer._checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
    }

    this[offset] = value & 0xff;
    this[offset + 1] = value >>> 8;
    this[offset + 2] = value >>> 16;
    this[offset + 3] = value >>> 24;

    return offset + 4;
  }

  /**
   * Writes `value` to `buf` at the specified `offset` as big-endian. The `value` must be a valid signed 32-bit
   * integer. Behavior is undefined when `value` is anything other than a signed 32-bit integer.
   *
   * @param value Number to write.
   * @param offset Number of bytes to skip before starting to write.
   * @param noAssert
   * @returns `offset` plus the number of bytes written.
   */
  public writeInt32BE(value: number, offset: number, noAssert?: boolean): number {
    value = +value;
    offset = offset >>> 0;

    if (!noAssert) {
      Buffer._checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
    }

    if (value < 0) {
      value = 0xffffffff + value + 1;
    }

    this[offset] = value >>> 24;
    this[offset + 1] = value >>> 16;
    this[offset + 2] = value >>> 8;
    this[offset + 3] = value & 0xff;

    return offset + 4;
  }

  /**
   * Fills `buf` with the specified `value`. If the `offset` and `end` are not given, the entire `buf` will be
   * filled. The `value` is coerced to a `uint32` value if it is not a string, `Buffer`, or integer. If the resulting
   * integer is greater than `255` (decimal), then `buf` will be filled with `value & 255`.
   *
   * If the final write of a `fill()` operation falls on a multi-byte character, then only the bytes of that
   * character that fit into `buf` are written.
   *
   * If `value` contains invalid characters, it is truncated; if no valid fill data remains, an exception is thrown.
   *
   * @param value
   * @param encoding
   */
  public fill(value: any, offset?: number, end?: number, encoding?: Encoding): this {
    if (typeof value === 'string') {
      if (typeof offset === 'string') {
        encoding = offset;
        offset = 0;
        end = this.length;
      } else if (typeof end === 'string') {
        encoding = end;
        end = this.length;
      }

      if (encoding !== undefined && typeof encoding !== 'string') {
        throw new TypeError('encoding must be a string');
      }

      if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
        throw new TypeError('Unknown encoding: ' + encoding);
      }

      if (value.length === 1) {
        const code = value.charCodeAt(0);

        if (encoding === 'utf8' && code < 128) {
          // Fast path: If `val` fits into a single byte, use that numeric value.
          value = code;
        }
      }
    } else if (typeof value === 'number') {
      value = value & 255;
    } else if (typeof value === 'boolean') {
      value = Number(value);
    }

    // Apply defaults
    offset ??= 0;
    end ??= this.length;

    // Invalid ranges are not set to a default, so can range check early.
    if (offset < 0 || this.length < offset || this.length < end) {
      throw new RangeError('Out of range index');
    }

    if (end <= offset) {
      return this;
    }

    offset = offset >>> 0;
    end = end === undefined ? this.length : end >>> 0;
    value ||= 0;

    let i: number;

    if (typeof value === 'number') {
      for (i = offset; i < end; ++i) {
        this[i] = value;
      }
    } else {
      const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, encoding);
      const len = bytes.length;

      if (len === 0) {
        throw new TypeError('The value "' + value + '" is invalid for argument "value"');
      }

      for (i = 0; i < end - offset; ++i) {
        this[i + offset] = bytes[i % len];
      }
    }

    return this;
  }

  /**
   * Returns the index of the specified value.
   *
   * If `value` is:
   * - a string, `value` is interpreted according to the character encoding in `encoding`.
   * - a `Buffer` or `Uint8Array`, `value` will be used in its entirety. To compare a partial Buffer, use `slice()`.
   * - a number, `value` will be interpreted as an unsigned 8-bit integer value between `0` and `255`.
   *
   * Any other types will throw a `TypeError`.
   *
   * @param value What to search for.
   * @param byteOffset Where to begin searching in `buf`. If negative, then calculated from the end.
   * @param encoding If `value` is a string, this is the encoding used to search.
   * @returns The index of the first occurrence of `value` in `buf`, or `-1` if not found.
   */
  public indexOf(value: string | number | Buffer, byteOffset?: number, encoding?: Encoding): number {
    return this._bidirectionalIndexOf(this, value, byteOffset, encoding, true);
  }

  /**
   * Gets the last index of the specified value.
   *
   * @see indexOf()
   * @param value
   * @param byteOffset
   * @param encoding
   */
  public lastIndexOf(value: string | number | Buffer, byteOffset?: number, encoding?: Encoding): number {
    return this._bidirectionalIndexOf(this, value, byteOffset, encoding, false);
  }

  private _bidirectionalIndexOf(
    buffer: Buffer,
    val: string | number | Buffer,
    byteOffset?: number,
    encoding?: Encoding,
    dir?: boolean
  ) {
    // Empty buffer means no match
    if (buffer.length === 0) {
      return -1;
    }

    // Normalize byteOffset
    if (typeof byteOffset === 'string') {
      encoding = byteOffset;
      byteOffset = 0;
    } else if (typeof byteOffset === 'undefined') {
      byteOffset = 0;
    } else if (byteOffset > 0x7fffffff) {
      byteOffset = 0x7fffffff;
    } else if (byteOffset < -0x80000000) {
      byteOffset = -0x80000000;
    }

    byteOffset = +byteOffset; // Coerce to Number.
    if (byteOffset !== byteOffset) {
      // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
      byteOffset = dir ? 0 : buffer.length - 1;
    }

    // Normalize byteOffset: negative offsets start from the end of the buffer
    if (byteOffset < 0) {
      byteOffset = buffer.length + byteOffset;
    }
    if (byteOffset >= buffer.length) {
      if (dir) {
        return -1;
      } else {
        byteOffset = buffer.length - 1;
      }
    } else if (byteOffset < 0) {
      if (dir) {
        byteOffset = 0;
      } else {
        return -1;
      }
    }

    // Normalize val
    if (typeof val === 'string') {
      val = Buffer.from(val, encoding);
    }

    // Finally, search either indexOf (if dir is true) or lastIndexOf
    if (Buffer.isBuffer(val)) {
      // Special case: looking for empty string/buffer always fails
      if (val.length === 0) {
        return -1;
      }

      return Buffer._arrayIndexOf(buffer, val, byteOffset, encoding, dir);
    } else if (typeof val === 'number') {
      val = val & 0xff; // Search for a byte value [0-255]

      if (typeof Uint8Array.prototype.indexOf === 'function') {
        if (dir) {
          return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
        } else {
          return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
        }
      }

      return Buffer._arrayIndexOf(buffer, Buffer.from([val]), byteOffset, encoding, dir);
    }

    throw new TypeError('val must be string, number or Buffer');
  }

  /**
   * Equivalent to `buf.indexOf() !== -1`.
   *
   * @param value
   * @param byteOffset
   * @param encoding
   */
  public includes(value: string | number | Buffer, byteOffset?: number, encoding?: Encoding): boolean {
    return this.indexOf(value, byteOffset, encoding) !== -1;
  }

  /**
   * Allocates a new Buffer using an `array` of octet values.
   *
   * @param array
   */
  public static from(array: number[]): Buffer;

  /**
   * When passed a reference to the .buffer property of a TypedArray instance, the newly created Buffer will share
   * the same allocated memory as the TypedArray. The optional `byteOffset` and `length` arguments specify a memory
   * range within the `arrayBuffer` that will be shared by the Buffer.
   *
   * @param buffer The .buffer property of a TypedArray or a new ArrayBuffer().
   * @param byteOffset
   * @param length
   */
  public static from(buffer: ArrayBuffer, byteOffset?: number, length?: number): Buffer;

  /**
   * Copies the passed `buffer` data onto a new Buffer instance.
   *
   * @param buffer
   */
  public static from(buffer: Buffer | Uint8Array): Buffer;

  /**
   * Creates a new Buffer containing the given string `str`. If provided, the `encoding` parameter identifies the
   * character encoding.
   *
   * @param str String to store in buffer.
   * @param encoding Encoding to use, optional. Default is `utf8`.
   */
  public static from(str: string, encoding?: Encoding): Buffer;

  /**
   * Creates a new buffer from the given parameters.
   *
   * @param data
   * @param encoding
   */
  public static from(
    a: string | number | Uint8Array | number[] | Buffer | ArrayBuffer,
    b?: Encoding | number,
    c?: number
  ): Buffer {
    return new Buffer(a as any, b as any, c);
  }

  /**
   * Returns true if `obj` is a Buffer.
   *
   * @param obj
   */
  public static isBuffer(obj: any): obj is Buffer {
    return obj != null && obj !== Buffer.prototype && Buffer._isInstance(obj, Buffer);
  }

  /**
   * Returns true if `encoding` is a supported encoding.
   *
   * @param encoding
   */
  public static isEncoding(encoding: string): encoding is Encoding {
    switch (encoding.toLowerCase()) {
      case 'hex':
      case 'utf8':
      case 'ascii':
      case 'binary':
      case 'latin1':
      case 'ucs2':
      case 'utf16le':
      case 'base64':
        return true;
      default:
        return false;
    }
  }

  /**
   * Gives the actual byte length of a string for an encoding. This is not the same as `string.length` since that
   * returns the number of characters in the string.
   *
   * @param string The string to test.
   * @param encoding The encoding to use for calculation. Defaults is `utf8`.
   */
  public static byteLength(string: string | Buffer | ArrayBuffer, encoding?: Encoding): number {
    if (Buffer.isBuffer(string)) {
      return string.length;
    }

    if (typeof string !== 'string' && (ArrayBuffer.isView(string) || Buffer._isInstance(string, ArrayBuffer))) {
      return string.byteLength;
    }

    if (typeof string !== 'string') {
      throw new TypeError(
        'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' + 'Received type ' + typeof string
      );
    }

    const len = string.length;
    const mustMatch = arguments.length > 2 && arguments[2] === true;

    if (!mustMatch && len === 0) {
      return 0;
    }

    // Use a for loop to avoid recursion
    switch (encoding?.toLowerCase()) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len;
      case 'utf8':
        return Buffer._utf8ToBytes(string).length;
      case 'hex':
        return len >>> 1;
      case 'ucs2':
      case 'utf16le':
        return len * 2;
      case 'base64':
        return Buffer._base64ToBytes(string).length;
      default:
        return mustMatch ? -1 : Buffer._utf8ToBytes(string).length; // assume utf8
    }
  }

  /**
   * Returns a Buffer which is the result of concatenating all the buffers in the list together.
   *
   * - If the list has no items, or if the `totalLength` is 0, then it returns a zero-length buffer.
   * - If the list has exactly one item, then the first item is returned.
   * - If the list has more than one item, then a new buffer is created.
   *
   * It is faster to provide the `totalLength` if it is known. However, it will be calculated if not provided at
   * a small computational expense.
   *
   * @param list An array of Buffer objects to concatenate.
   * @param totalLength Total length of the buffers when concatenated.
   */
  public static concat(list: Uint8Array[], totalLength?: number): Buffer {
    if (!Array.isArray(list)) {
      throw new TypeError('"list" argument must be an Array of Buffers');
    }

    if (list.length === 0) {
      return Buffer.alloc(0);
    }

    let i: number;
    if (totalLength === undefined) {
      totalLength = 0;

      for (i = 0; i < list.length; ++i) {
        totalLength += list[i].length;
      }
    }

    const buffer = Buffer.allocUnsafe(totalLength);
    let pos = 0;

    for (i = 0; i < list.length; ++i) {
      let buf = list[i];

      if (Buffer._isInstance(buf, Uint8Array)) {
        if (pos + buf.length > buffer.length) {
          if (!Buffer.isBuffer(buf)) {
            buf = Buffer.from(buf);
          }

          (buf as Buffer).copy(buffer, pos);
        } else {
          Uint8Array.prototype.set.call(buffer, buf, pos);
        }
      } else if (!Buffer.isBuffer(buf)) {
        throw new TypeError('"list" argument must be an Array of Buffers');
      } else {
        (buf as Buffer).copy(buffer, pos);
      }

      pos += buf.length;
    }

    return buffer;
  }

  /**
   * The same as `buf1.compare(buf2)`.
   */
  public static compare(buf1: Uint8Array, buf2: Uint8Array): number {
    if (Buffer._isInstance(buf1, Uint8Array)) {
      buf1 = Buffer.from(buf1, buf1.byteOffset, buf1.byteLength);
    }

    if (Buffer._isInstance(buf2, Uint8Array)) {
      buf2 = Buffer.from(buf2, buf2.byteOffset, buf2.byteLength);
    }

    if (!Buffer.isBuffer(buf1) || !Buffer.isBuffer(buf2)) {
      throw new TypeError('The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array');
    }

    if (buf1 === buf2) {
      return 0;
    }

    let x = buf1.length;
    let y = buf2.length;

    for (let i = 0, len = Math.min(x, y); i < len; ++i) {
      if (buf1[i] !== buf2[i]) {
        x = buf1[i];
        y = buf2[i];

        break;
      }
    }

    if (x < y) {
      return -1;
    }

    if (y < x) {
      return 1;
    }

    return 0;
  }

  /**
   * Allocates a new buffer of `size` octets.
   *
   * @param size The number of octets to allocate.
   * @param fill If specified, the buffer will be initialized by calling `buf.fill(fill)`, or with zeroes otherwise.
   * @param encoding The encoding used for the call to `buf.fill()` while initializing.
   */
  public static alloc(size: number, fill?: string | Buffer | number, encoding?: Encoding): Buffer {
    if (typeof size !== 'number') {
      throw new TypeError('"size" argument must be of type number');
    } else if (size < 0) {
      throw new RangeError('The value "' + size + '" is invalid for option "size"');
    }

    if (size <= 0) {
      return new Buffer(size);
    }

    if (fill !== undefined) {
      // Only pay attention to encoding if it's a string. This
      // prevents accidentally sending in a number that would
      // be interpreted as a start offset.
      return typeof encoding === 'string'
        ? new Buffer(size).fill(fill, 0, size, encoding)
        : new Buffer(size).fill(fill);
    }

    return new Buffer(size);
  }

  /**
   * Allocates a new buffer of `size` octets without initializing memory. The contents of the buffer are unknown.
   *
   * @param size
   */
  public static allocUnsafe(size: number): Buffer {
    if (typeof size !== 'number') {
      throw new TypeError('"size" argument must be of type number');
    } else if (size < 0) {
      throw new RangeError('The value "' + size + '" is invalid for option "size"');
    }

    return new Buffer(size < 0 ? 0 : Buffer._checked(size) | 0);
  }

  /**
   * Returns true if the given `obj` is an instance of `type`.
   *
   * @param obj
   * @param type
   */
  private static _isInstance(obj: any, type: any): obj is typeof type {
    return (
      obj instanceof type ||
      (obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type.name)
    );
  }

  private static _checked(length: number) {
    if (length >= K_MAX_LENGTH) {
      throw new RangeError(
        'Attempt to allocate Buffer larger than maximum ' + 'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes'
      );
    }

    return length | 0;
  }

  private static _blitBuffer(src: number[] | Uint8Array, dst: Buffer, offset: number, length: number) {
    let i: number;

    for (i = 0; i < length; ++i) {
      if (i + offset >= dst.length || i >= src.length) {
        break;
      }

      dst[i + offset] = src[i];
    }

    return i;
  }

  private static _utf8Write(buf: Buffer, string: string, offset: number, length: number) {
    return Buffer._blitBuffer(Buffer._utf8ToBytes(string, buf.length - offset), buf, offset, length);
  }

  private static _asciiWrite(buf: Buffer, string: string, offset: number, length: number) {
    return Buffer._blitBuffer(Buffer._asciiToBytes(string), buf, offset, length);
  }

  private static _base64Write(buf: Buffer, string: string, offset: number, length: number) {
    return Buffer._blitBuffer(Buffer._base64ToBytes(string), buf, offset, length);
  }

  private static _ucs2Write(buf: Buffer, string: string, offset: number, length: number) {
    return Buffer._blitBuffer(Buffer._utf16leToBytes(string, buf.length - offset), buf, offset, length);
  }

  private static _hexWrite(buf: Buffer, string: string, offset: number, length: number) {
    offset = Number(offset) || 0;

    const remaining = buf.length - offset;

    if (!length) {
      length = remaining;
    } else {
      length = Number(length);

      if (length > remaining) {
        length = remaining;
      }
    }

    const strLen = string.length;

    if (length > strLen / 2) {
      length = strLen / 2;
    }

    let i;

    for (i = 0; i < length; ++i) {
      const parsed = parseInt(string.substr(i * 2, 2), 16);

      if (parsed !== parsed) {
        return i;
      }

      buf[offset + i] = parsed;
    }

    return i;
  }

  private static _utf8ToBytes(string: string, units?: number) {
    units = units || Infinity;

    const length = string.length;
    const bytes = [];

    let codePoint;
    let leadSurrogate = null;

    for (let i = 0; i < length; ++i) {
      codePoint = string.charCodeAt(i);

      // is surrogate component
      if (codePoint > 0xd7ff && codePoint < 0xe000) {
        // last char was a lead
        if (!leadSurrogate) {
          // no lead yet
          if (codePoint > 0xdbff) {
            // unexpected trail
            if ((units -= 3) > -1) {
              bytes.push(0xef, 0xbf, 0xbd);
            }

            continue;
          } else if (i + 1 === length) {
            // unpaired lead
            if ((units -= 3) > -1) {
              bytes.push(0xef, 0xbf, 0xbd);
            }

            continue;
          }

          // valid lead
          leadSurrogate = codePoint;

          continue;
        }

        // 2 leads in a row
        if (codePoint < 0xdc00) {
          if ((units -= 3) > -1) {
            bytes.push(0xef, 0xbf, 0xbd);
          }

          leadSurrogate = codePoint;
          continue;
        }

        // valid surrogate pair
        codePoint = (((leadSurrogate - 0xd800) << 10) | (codePoint - 0xdc00)) + 0x10000;
      } else if (leadSurrogate) {
        // valid bmp char, but last char was a lead
        if ((units -= 3) > -1) {
          bytes.push(0xef, 0xbf, 0xbd);
        }
      }

      leadSurrogate = null;

      // encode utf8
      if (codePoint < 0x80) {
        if ((units -= 1) < 0) {
          break;
        }

        bytes.push(codePoint);
      } else if (codePoint < 0x800) {
        if ((units -= 2) < 0) {
          break;
        }

        bytes.push((codePoint >> 0x6) | 0xc0, (codePoint & 0x3f) | 0x80);
      } else if (codePoint < 0x10000) {
        if ((units -= 3) < 0) {
          break;
        }

        bytes.push((codePoint >> 0xc) | 0xe0, ((codePoint >> 0x6) & 0x3f) | 0x80, (codePoint & 0x3f) | 0x80);
      } else if (codePoint < 0x110000) {
        if ((units -= 4) < 0) {
          break;
        }

        bytes.push(
          (codePoint >> 0x12) | 0xf0,
          ((codePoint >> 0xc) & 0x3f) | 0x80,
          ((codePoint >> 0x6) & 0x3f) | 0x80,
          (codePoint & 0x3f) | 0x80
        );
      } else {
        throw new Error('Invalid code point');
      }
    }

    return bytes;
  }

  private static _base64ToBytes(str: string) {
    return base64.toByteArray(base64clean(str));
  }

  private static _asciiToBytes(str: string) {
    const byteArray = [];

    for (let i = 0; i < str.length; ++i) {
      // Node's code seems to be doing this and not & 0x7F..
      byteArray.push(str.charCodeAt(i) & 0xff);
    }

    return byteArray;
  }

  private static _utf16leToBytes(str: string, units: number) {
    let c, hi, lo;
    const byteArray = [];

    for (let i = 0; i < str.length; ++i) {
      if ((units -= 2) < 0) break;

      c = str.charCodeAt(i);
      hi = c >> 8;
      lo = c % 256;

      byteArray.push(lo);
      byteArray.push(hi);
    }

    return byteArray;
  }

  private static _hexSlice(buf: Buffer, start: number, end: number) {
    const len = buf.length;

    if (!start || start < 0) {
      start = 0;
    }

    if (!end || end < 0 || end > len) {
      end = len;
    }

    let out = '';
    for (let i = start; i < end; ++i) {
      out += hexSliceLookupTable[buf[i]];
    }

    return out;
  }

  private static _base64Slice(buf: Buffer, start: number, end: number) {
    if (start === 0 && end === buf.length) {
      return base64.fromByteArray(buf);
    } else {
      return base64.fromByteArray(buf.slice(start, end));
    }
  }

  private static _utf8Slice(buf: Buffer, start: number, end: number) {
    end = Math.min(buf.length, end);
    const res: number[] = [];

    let i = start;
    while (i < end) {
      const firstByte = buf[i];
      let codePoint = null;
      let bytesPerSequence = firstByte > 0xef ? 4 : firstByte > 0xdf ? 3 : firstByte > 0xbf ? 2 : 1;

      if (i + bytesPerSequence <= end) {
        let secondByte, thirdByte, fourthByte, tempCodePoint;

        switch (bytesPerSequence) {
          case 1:
            if (firstByte < 0x80) {
              codePoint = firstByte;
            }

            break;
          case 2:
            secondByte = buf[i + 1];

            if ((secondByte & 0xc0) === 0x80) {
              tempCodePoint = ((firstByte & 0x1f) << 0x6) | (secondByte & 0x3f);

              if (tempCodePoint > 0x7f) {
                codePoint = tempCodePoint;
              }
            }

            break;
          case 3:
            secondByte = buf[i + 1];
            thirdByte = buf[i + 2];

            if ((secondByte & 0xc0) === 0x80 && (thirdByte & 0xc0) === 0x80) {
              tempCodePoint = ((firstByte & 0xf) << 0xc) | ((secondByte & 0x3f) << 0x6) | (thirdByte & 0x3f);

              if (tempCodePoint > 0x7ff && (tempCodePoint < 0xd800 || tempCodePoint > 0xdfff)) {
                codePoint = tempCodePoint;
              }
            }

            break;
          case 4:
            secondByte = buf[i + 1];
            thirdByte = buf[i + 2];
            fourthByte = buf[i + 3];

            if ((secondByte & 0xc0) === 0x80 && (thirdByte & 0xc0) === 0x80 && (fourthByte & 0xc0) === 0x80) {
              tempCodePoint =
                ((firstByte & 0xf) << 0x12) |
                ((secondByte & 0x3f) << 0xc) |
                ((thirdByte & 0x3f) << 0x6) |
                (fourthByte & 0x3f);

              if (tempCodePoint > 0xffff && tempCodePoint < 0x110000) {
                codePoint = tempCodePoint;
              }
            }
        }
      }

      if (codePoint === null) {
        // we did not generate a valid codePoint so insert a
        // replacement char (U+FFFD) and advance only 1 byte
        codePoint = 0xfffd;
        bytesPerSequence = 1;
      } else if (codePoint > 0xffff) {
        // encode to utf16 (surrogate pair dance)
        codePoint -= 0x10000;
        res.push(((codePoint >>> 10) & 0x3ff) | 0xd800);
        codePoint = 0xdc00 | (codePoint & 0x3ff);
      }

      res.push(codePoint);
      i += bytesPerSequence;
    }

    return Buffer._decodeCodePointsArray(res);
  }

  private static _decodeCodePointsArray(codePoints: number[]) {
    const len = codePoints.length;

    if (len <= MAX_ARGUMENTS_LENGTH) {
      return String.fromCharCode.apply(String, codePoints); // avoid extra slice()
    }

    // Decode in chunks to avoid "call stack size exceeded".
    let res = '';
    let i = 0;

    while (i < len) {
      res += String.fromCharCode.apply(String, codePoints.slice(i, (i += MAX_ARGUMENTS_LENGTH)));
    }

    return res;
  }

  private static _asciiSlice(buf: Buffer, start: number, end: number) {
    let ret = '';
    end = Math.min(buf.length, end);

    for (let i = start; i < end; ++i) {
      ret += String.fromCharCode(buf[i] & 0x7f);
    }

    return ret;
  }

  private static _latin1Slice(buf: Buffer, start: number, end: number) {
    let ret = '';
    end = Math.min(buf.length, end);

    for (let i = start; i < end; ++i) {
      ret += String.fromCharCode(buf[i]);
    }

    return ret;
  }

  private static _utf16leSlice(buf: Buffer, start: number, end: number) {
    const bytes = buf.slice(start, end);
    let res = '';

    // If bytes.length is odd, the last 8 bits must be ignored (same as node.js)
    for (let i = 0; i < bytes.length - 1; i += 2) {
      res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
    }

    return res;
  }

  private static _arrayIndexOf(arr: Buffer, val: Buffer, byteOffset: number, encoding?: string, dir?: boolean) {
    let indexSize = 1;
    let arrLength = arr.length;
    let valLength = val.length;

    if (encoding !== undefined) {
      encoding = Buffer._getEncoding(encoding);

      if (encoding === 'ucs2' || encoding === 'utf16le') {
        if (arr.length < 2 || val.length < 2) {
          return -1;
        }

        indexSize = 2;
        arrLength /= 2;
        valLength /= 2;
        byteOffset /= 2;
      }
    }

    function read(buf: Buffer, i: number) {
      if (indexSize === 1) {
        return buf[i];
      } else {
        return (buf as Buffer).readUInt16BE(i * indexSize);
      }
    }

    let i: number;

    if (dir) {
      let foundIndex = -1;

      for (i = byteOffset; i < arrLength; i++) {
        if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
          if (foundIndex === -1) foundIndex = i;
          if (i - foundIndex + 1 === valLength) return foundIndex * indexSize;
        } else {
          if (foundIndex !== -1) i -= i - foundIndex;
          foundIndex = -1;
        }
      }
    } else {
      if (byteOffset + valLength > arrLength) {
        byteOffset = arrLength - valLength;
      }

      for (i = byteOffset; i >= 0; i--) {
        let found = true;

        for (let j = 0; j < valLength; j++) {
          if (read(arr, i + j) !== read(val, j)) {
            found = false;
            break;
          }
        }

        if (found) {
          return i;
        }
      }
    }

    return -1;
  }

  private static _checkOffset(offset: number, ext: number, length: number) {
    if (offset % 1 !== 0 || offset < 0) throw new RangeError('offset is not uint');
    if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length');
  }

  private static _checkInt(buf: Buffer, value: number, offset: number, ext: number, max: number, min: number) {
    if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
    if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
    if (offset + ext > buf.length) throw new RangeError('Index out of range');
  }

  private static _getEncoding(encoding: string): Encoding {
    let toLowerCase = false;
    let originalEncoding = '';

    for (;;) {
      switch (encoding) {
        case 'hex':
          return 'hex';
        case 'utf8':
          return 'utf8';
        case 'ascii':
          return 'ascii';
        case 'binary':
          return 'binary';
        case 'latin1':
          return 'latin1';
        case 'ucs2':
          return 'ucs2';
        case 'utf16le':
          return 'utf16le';
        case 'base64':
          return 'base64';

        default: {
          if (toLowerCase) {
            throw new TypeError('Unknown or unsupported encoding: ' + originalEncoding);
          }

          toLowerCase = true;
          originalEncoding = encoding;
          encoding = encoding.toLowerCase();
        }
      }
    }
  }
}

/**
 * Utility table for hex slicing.
 */
const hexSliceLookupTable = (function () {
  const alphabet = '0123456789abcdef';
  const table = new Array(256);

  for (let i = 0; i < 16; ++i) {
    const i16 = i * 16;

    for (let j = 0; j < 16; ++j) {
      table[i16 + j] = alphabet[i] + alphabet[j];
    }
  }

  return table;
})();

/**
 * Regular expression for invalid Base64 characters.
 */
const INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;

function base64clean(str: string) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0];
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '');
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return '';
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '=';
  }
  return str;
}

/**
 * The encodings that are supported in both native and polyfilled `Buffer` instances.
 */
export type Encoding = 'ascii' | 'utf8' | 'utf16le' | 'ucs2' | 'binary' | 'hex' | 'latin1' | 'base64';

// @ts-ignore
if (typeof global !== 'undefined' && typeof global.Buffer !== 'undefined') Buffer = global.Buffer;

export { Buffer };
