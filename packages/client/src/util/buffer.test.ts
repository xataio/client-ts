import { describe, test, expect } from 'vitest';
import { Buffer } from './buffer';

function equal<A, B>(a: A, b: B) {
  expect(a).toEqual(b);
}

describe('buffer', () => {
  test('detect utf16 surrogate pairs', () => {
    const text = '\uD83D\uDE38' + '\uD83D\uDCAD' + '\uD83D\uDC4D';
    const buf = new Buffer(text);
    equal(text, buf.toString());
  });

  test('detect utf16 surrogate pairs over U+20000 until U+10FFFF', () => {
    const text = '\uD842\uDFB7' + '\uD93D\uDCAD' + '\uDBFF\uDFFF';
    const buf = new Buffer(text);
    equal(text, buf.toString());
  });

  test('replace orphaned utf16 surrogate lead code point', () => {
    const text = '\uD83D\uDE38' + '\uD83D' + '\uD83D\uDC4D';
    const buf = new Buffer(text);
    equal(buf, new Buffer([0xf0, 0x9f, 0x98, 0xb8, 0xef, 0xbf, 0xbd, 0xf0, 0x9f, 0x91, 0x8d]));
  });

  test('replace orphaned utf16 surrogate trail code point', () => {
    const text = '\uD83D\uDE38' + '\uDCAD' + '\uD83D\uDC4D';
    const buf = new Buffer(text);
    equal(buf, new Buffer([0xf0, 0x9f, 0x98, 0xb8, 0xef, 0xbf, 0xbd, 0xf0, 0x9f, 0x91, 0x8d]));
  });

  test('do not write partial utf16 code units', () => {
    const f = new Buffer([0, 0, 0, 0, 0]);
    equal(f.length, 5);
    const size = f.write('あいうえお', 'utf16le');
    equal(size, 4);
    equal(f, new Buffer([0x42, 0x30, 0x44, 0x30, 0x00]));
  });

  test('handle partial utf16 code points when encoding to utf8 the way node does', () => {
    const text = '\uD83D\uDE38' + '\uD83D\uDC4D';

    let buf = new Buffer(8);
    buf.fill(0);
    buf.write(text);
    equal(buf, new Buffer([0xf0, 0x9f, 0x98, 0xb8, 0xf0, 0x9f, 0x91, 0x8d]));

    buf = new Buffer(7);
    buf.fill(0);
    buf.write(text);
    equal(buf, new Buffer([0xf0, 0x9f, 0x98, 0xb8, 0x00, 0x00, 0x00]));

    buf = new Buffer(6);
    buf.fill(0);
    buf.write(text);
    equal(buf, new Buffer([0xf0, 0x9f, 0x98, 0xb8, 0x00, 0x00]));

    buf = new Buffer(5);
    buf.fill(0);
    buf.write(text);
    equal(buf, new Buffer([0xf0, 0x9f, 0x98, 0xb8, 0x00]));

    buf = new Buffer(4);
    buf.fill(0);
    buf.write(text);
    equal(buf, new Buffer([0xf0, 0x9f, 0x98, 0xb8]));

    buf = new Buffer(3);
    buf.fill(0);
    buf.write(text);
    equal(buf, new Buffer([0x00, 0x00, 0x00]));

    buf = new Buffer(2);
    buf.fill(0);
    buf.write(text);
    equal(buf, new Buffer([0x00, 0x00]));

    buf = new Buffer(1);
    buf.fill(0);
    buf.write(text);
    equal(buf, new Buffer([0x00]));
  });

  test('handle invalid utf16 code points when encoding to utf8 the way node does', () => {
    const text = 'a' + '\uDE38\uD83D' + 'b';

    let buf = new Buffer(8);
    buf.fill(0);
    buf.write(text);
    equal(buf, new Buffer([0x61, 0xef, 0xbf, 0xbd, 0xef, 0xbf, 0xbd, 0x62]));

    buf = new Buffer(7);
    buf.fill(0);
    buf.write(text);
    equal(buf, new Buffer([0x61, 0xef, 0xbf, 0xbd, 0xef, 0xbf, 0xbd]));

    buf = new Buffer(6);
    buf.fill(0);
    buf.write(text);
    equal(buf, new Buffer([0x61, 0xef, 0xbf, 0xbd, 0x00, 0x00]));

    buf = new Buffer(5);
    buf.fill(0);
    buf.write(text);
    equal(buf, new Buffer([0x61, 0xef, 0xbf, 0xbd, 0x00]));

    buf = new Buffer(4);
    buf.fill(0);
    buf.write(text);
    equal(buf, new Buffer([0x61, 0xef, 0xbf, 0xbd]));

    buf = new Buffer(3);
    buf.fill(0);
    buf.write(text);
    equal(buf, new Buffer([0x61, 0x00, 0x00]));

    buf = new Buffer(2);
    buf.fill(0);
    buf.write(text);
    equal(buf, new Buffer([0x61, 0x00]));

    buf = new Buffer(1);
    buf.fill(0);
    buf.write(text);
    equal(buf, new Buffer([0x61]));
  });

  test('base64: ignore whitespace', () => {
    const text = '\n   YW9ldQ==  ';
    const buf = new Buffer(text, 'base64');
    equal(buf.toString(), 'aoeu');
  });

  test('base64: strings without padding', () => {
    equal(new Buffer('YW9ldQ', 'base64').toString(), 'aoeu');
  });

  test('base64: newline in utf8 -- should not be an issue', () => {
    equal(
      new Buffer('LS0tCnRpdGxlOiBUaHJlZSBkYXNoZXMgbWFya3MgdGhlIHNwb3QKdGFnczoK', 'base64').toString('utf8'),
      '---\ntitle: Three dashes marks the spot\ntags:\n'
    );
  });

  test('base64: newline in base64 -- should get stripped', () => {
    equal(
      new Buffer(
        'LS0tCnRpdGxlOiBUaHJlZSBkYXNoZXMgbWFya3MgdGhlIHNwb3QKdGFnczoK\nICAtIHlhbWwKICAtIGZyb250LW1hdHRlcgogIC0gZGFzaGVzCmV4cGFuZWQt',
        'base64'
      ).toString('utf8'),
      '---\ntitle: Three dashes marks the spot\ntags:\n  - yaml\n  - front-matter\n  - dashes\nexpaned-'
    );
  });

  test('base64: tab characters in base64 - should get stripped', () => {
    equal(
      new Buffer(
        'LS0tCnRpdGxlOiBUaHJlZSBkYXNoZXMgbWFya3MgdGhlIHNwb3QKdGFnczoK\t\t\t\tICAtIHlhbWwKICAtIGZyb250LW1hdHRlcgogIC0gZGFzaGVzCmV4cGFuZWQt',
        'base64'
      ).toString('utf8'),
      '---\ntitle: Three dashes marks the spot\ntags:\n  - yaml\n  - front-matter\n  - dashes\nexpaned-'
    );
  });

  test('base64: invalid non-alphanumeric characters -- should be stripped', () => {
    equal(new Buffer('!"#$%&\'()*,.:;<=>?@[\\]^`{|}~', 'base64').toString('utf8'), '');
  });

  test('base64: high byte', () => {
    const highByte = Buffer.from([128]);
    equal(Buffer.alloc(1, highByte.toString('base64'), 'base64'), highByte);
  });

  test('instanceof Buffer', () => {
    const buf = new Buffer([1, 2]);
    expect(buf).toBeInstanceOf(Buffer);
  });

  test('convert to Uint8Array in modern browsers', () => {
    const buf = new Buffer([1, 2]);
    const uint8array = new Uint8Array(buf.buffer);
    expect(uint8array).toBeInstanceOf(Uint8Array);
    equal(uint8array[0], 1);
    equal(uint8array[1], 2);
  });

  test('indexes from a string', () => {
    const buf = new Buffer('abc');
    equal(buf[0], 97);
    equal(buf[1], 98);
    equal(buf[2], 99);
  });

  test('indexes from an array', () => {
    const buf = new Buffer([97, 98, 99]);
    equal(buf[0], 97);
    equal(buf[1], 98);
    equal(buf[2], 99);
  });

  test('setting index value should modify buffer contents', () => {
    const buf = new Buffer([97, 98, 99]);
    equal(buf[2], 99);
    equal(buf.toString(), 'abc');

    buf[2] += 10;
    equal(buf[2], 109);
    equal(buf.toString(), 'abm');
  });

  test('storing negative number should cast to unsigned', () => {
    let buf = new Buffer(1);

    buf[0] = -3;
    equal(buf[0], 253);

    buf = new Buffer(1);
    buf.writeInt8(-3, 0);
    equal(buf[0], 253);
  });

  test('test that memory is copied from array-like', () => {
    const u = new Uint8Array(4);
    const b = new Buffer(u);
    b[0] = 1;
    b[1] = 2;
    b[2] = 3;
    b[3] = 4;

    equal(u[0], 0);
    equal(u[1], 0);
    equal(u[2], 0);
    equal(u[3], 0);
  });

  test('buffer.compare', () => {
    const b = new Buffer(1).fill('a');
    const c = new Buffer(1).fill('c');
    const d = new Buffer(2).fill('aa');

    equal(b.compare(c), -1);
    equal(c.compare(d), 1);
    equal(d.compare(b), 1);
    equal(b.compare(d), -1);

    // static method
    equal(Buffer.compare(b, c), -1);
    equal(Buffer.compare(c, d), 1);
    equal(Buffer.compare(d, b), 1);
    equal(Buffer.compare(b, d), -1);
  });

  test('buffer.equals', () => {
    const b = new Buffer(5).fill('abcdf');
    const c = new Buffer(5).fill('abcdf');
    const d = new Buffer(5).fill('abcde');
    const e = new Buffer(6).fill('abcdef');

    expect(b.equals(c)).toBe(true);
    expect(!c.equals(d)).toBe(true);
    expect(!d.equals(e)).toBe(true);
  });

  test('new buffer from array', () => {
    equal(new Buffer([1, 2, 3]).toString(), '\u0001\u0002\u0003');
  });

  test('new buffer from array w/ negatives', () => {
    equal(new Buffer([-1, -2, -3]).toString('hex'), 'fffefd');
  });

  test('new buffer from array with mixed signed input', () => {
    equal(new Buffer([-255, 255, -128, 128, 512, -512, 511, -511]).toString('hex'), '01ff80800000ff01');
  });

  test('new buffer from string', () => {
    equal(new Buffer('hey', 'utf8').toString(), 'hey');
  });

  test('new buffer from buffer', () => {
    const b1 = new Buffer('asdf');
    const b2 = new Buffer(b1);
    equal(b1.toString('hex'), b2.toString('hex'));
  });

  test('new buffer from ArrayBuffer', () => {
    if (typeof ArrayBuffer !== 'undefined') {
      const arraybuffer = new Uint8Array([0, 1, 2, 3]).buffer;
      const b = new Buffer(arraybuffer);
      equal(b.length, 4);
      equal(b[0], 0);
      equal(b[1], 1);
      equal(b[2], 2);
      equal(b[3], 3);
      equal(b[4], undefined);
    }
  });

  test.skip('new buffer from ArrayBuffer, shares memory', () => {
    const u = new Uint8Array([0, 1, 2, 3]);
    const arraybuffer = u.buffer;
    const b = new Buffer(arraybuffer);
    equal(b.length, 4);
    equal(b[0], 0);
    equal(b[1], 1);
    equal(b[2], 2);
    equal(b[3], 3);
    equal(b[4], undefined);

    // changing the Uint8Array (and thus the ArrayBuffer), changes the Buffer
    u[0] = 10;
    equal(b[0], 10);
    u[1] = 11;
    equal(b[1], 11);
    u[2] = 12;
    equal(b[2], 12);
    u[3] = 13;
    equal(b[3], 13);
  });

  test('new buffer from Uint8Array', () => {
    if (typeof Uint8Array !== 'undefined') {
      const b1 = new Uint8Array([0, 1, 2, 3]);
      const b2 = new Buffer(b1);
      equal(b1.length, b2.length);
      equal(b1[0], 0);
      equal(b1[1], 1);
      equal(b1[2], 2);
      equal(b1[3], 3);
      equal(b1[4], undefined);
    }
  });

  test('new buffer from Uint16Array', () => {
    if (typeof Uint16Array !== 'undefined') {
      const b1 = new Uint16Array([0, 1, 2, 3]);
      const b2 = new Buffer(b1);
      equal(b1.length, b2.length);
      equal(b1[0], 0);
      equal(b1[1], 1);
      equal(b1[2], 2);
      equal(b1[3], 3);
      equal(b1[4], undefined);
    }
  });

  test('new buffer from Uint32Array', () => {
    if (typeof Uint32Array !== 'undefined') {
      const b1 = new Uint32Array([0, 1, 2, 3]);
      const b2 = new Buffer(b1);
      equal(b1.length, b2.length);
      equal(b1[0], 0);
      equal(b1[1], 1);
      equal(b1[2], 2);
      equal(b1[3], 3);
      equal(b1[4], undefined);
    }
  });

  test('new buffer from Int16Array', () => {
    if (typeof Int16Array !== 'undefined') {
      const b1 = new Int16Array([0, 1, 2, 3]);
      const b2 = new Buffer(b1);
      equal(b1.length, b2.length);
      equal(b1[0], 0);
      equal(b1[1], 1);
      equal(b1[2], 2);
      equal(b1[3], 3);
      equal(b1[4], undefined);
    }
  });

  test('new buffer from Int32Array', () => {
    if (typeof Int32Array !== 'undefined') {
      const b1 = new Int32Array([0, 1, 2, 3]);
      const b2 = new Buffer(b1);
      equal(b1.length, b2.length);
      equal(b1[0], 0);
      equal(b1[1], 1);
      equal(b1[2], 2);
      equal(b1[3], 3);
      equal(b1[4], undefined);
    }
  });

  test('new buffer from Float32Array', () => {
    if (typeof Float32Array !== 'undefined') {
      const b1 = new Float32Array([0, 1, 2, 3]);
      const b2 = new Buffer(b1);
      equal(b1.length, b2.length);
      equal(b1[0], 0);
      equal(b1[1], 1);
      equal(b1[2], 2);
      equal(b1[3], 3);
      equal(b1[4], undefined);
    }
  });

  test('new buffer from Float64Array', () => {
    if (typeof Float64Array !== 'undefined') {
      const b1 = new Float64Array([0, 1, 2, 3]);
      const b2 = new Buffer(b1);
      equal(b1.length, b2.length);
      equal(b1[0], 0);
      equal(b1[1], 1);
      equal(b1[2], 2);
      equal(b1[3], 3);
      equal(b1[4], undefined);
    }
  });

  test.skip('new buffer from buffer.toJSON() output', () => {
    if (typeof JSON === 'undefined') {
      // ie6, ie7 lack support

      return;
    }
    const buf = new Buffer('test');
    const json = JSON.stringify(buf);
    const obj = JSON.parse(json);
    const copy = new Buffer(obj);
    expect(buf.equals(copy)).toBe(true);
  });

  test('buffer.toJSON', () => {
    const data = [1, 2, 3, 4];
    equal(new Buffer(data).toJSON(), { type: 'Buffer', data: [1, 2, 3, 4] });
  });

  test('buffer.copy', () => {
    // copied from nodejs.org example
    const buf1 = new Buffer(26);
    const buf2 = new Buffer(26);

    for (let i = 0; i < 26; i++) {
      buf1[i] = i + 97; // 97 is ASCII a
      buf2[i] = 33; // ASCII !
    }

    buf1.copy(buf2, 8, 16, 20);

    equal(buf2.toString('ascii', 0, 25), '!!!!!!!!qrst!!!!!!!!!!!!!');
  });

  test('test offset returns are correct', () => {
    const b = new Buffer(16);
    equal(4, b.writeUInt32LE(0, 0));
    equal(6, b.writeUInt16LE(0, 4));
    equal(7, b.writeUInt8(0, 6));
    equal(8, b.writeInt8(0, 7));
  });

  test('concat() a varying number of buffers', () => {
    const zero: any[] = [];
    const one = [new Buffer('asdf')];
    const long = [];
    for (let i = 0; i < 10; i++) {
      long.push(new Buffer('asdf'));
    }

    const flatZero = Buffer.concat(zero);
    const flatOne = Buffer.concat(one);
    const flatLong = Buffer.concat(long);
    const flatLongLen = Buffer.concat(long, 40);

    equal(flatZero.length, 0);
    equal(flatOne.toString(), 'asdf');
    equal(flatOne, one[0]);
    equal(flatLong.toString(), new Array(10 + 1).join('asdf'));
    equal(flatLongLen.toString(), new Array(10 + 1).join('asdf'));
  });

  test('concat() works on Uint8Array instances', () => {
    const result = Buffer.concat([new Uint8Array([1, 2]), new Uint8Array([3, 4])]);
    const expected = Buffer.from([1, 2, 3, 4]);
    equal(result, expected);
  });

  test('concat() works on Uint8Array instances for smaller provided totalLength', () => {
    const result = Buffer.concat([new Uint8Array([1, 2]), new Uint8Array([3, 4])], 3);
    const expected = Buffer.from([1, 2, 3]);
    equal(result, expected);
  });

  test('fill', () => {
    const b = new Buffer(10);
    b.fill(2);
    equal(b.toString('hex'), '02020202020202020202');
  });

  test('fill (string)', () => {
    const b = new Buffer(10);
    b.fill('abc');
    equal(b.toString(), 'abcabcabca');
    b.fill('է');
    equal(b.toString(), 'էէէէէ');
  });

  test('copy() empty buffer with sourceEnd=0', () => {
    const source = new Buffer([42]);
    const destination = new Buffer([43]);
    source.copy(destination, 0, 0, 0);
    equal(destination.readUInt8(0), 43);
  });

  test('copy() after slice()', () => {
    const source = new Buffer(200);
    const dest = new Buffer(200);
    const expected = new Buffer(200);
    for (let i = 0; i < 200; i++) {
      source[i] = i;
      dest[i] = 0;
    }

    source.slice(2).copy(dest);
    source.copy(expected, 0, 2);
    equal(dest, expected);
  });

  test('copy() ascending', () => {
    const b = new Buffer('abcdefghij');
    b.copy(b, 0, 3, 10);
    equal(b.toString(), 'defghijhij');
  });

  test('copy() descending', () => {
    const b = new Buffer('abcdefghij');
    b.copy(b, 3, 0, 7);
    equal(b.toString(), 'abcabcdefg');
  });

  test('buffer.slice sets indexes', () => {
    equal(new Buffer('hallo').slice(0, 5).toString(), 'hallo');
  });

  test('buffer.slice out of range', () => {
    equal(new Buffer('hallo').slice(0, 10).toString(), 'hallo');
    equal(new Buffer('hallo').slice(10, 2).toString(), '');
  });

  test.skip('modifying buffer created by .slice() modifies original memory', () => {
    const buf1 = new Buffer(26);
    for (let i = 0; i < 26; i++) {
      buf1[i] = i + 97; // 97 is ASCII a
    }

    const buf2 = buf1.slice(0, 3);
    equal(buf2.toString('ascii', 0, buf2.length), 'abc');

    buf2[0] = '!'.charCodeAt(0);
    equal(buf1.toString('ascii', 0, buf2.length), '!bc');
  });

  test.skip("modifying parent buffer modifies .slice() buffer's memory", () => {
    const buf1 = new Buffer(26);
    for (let i = 0; i < 26; i++) {
      buf1[i] = i + 97; // 97 is ASCII a
    }

    const buf2 = buf1.slice(0, 3);
    equal(buf2.toString('ascii', 0, buf2.length), 'abc');

    buf1[0] = '!'.charCodeAt(0);
    equal(buf2.toString('ascii', 0, buf2.length), '!bc');
  });

  test('Buffer.isEncoding', () => {
    equal(Buffer.isEncoding('HEX'), true);
    equal(Buffer.isEncoding('hex'), true);
    equal(Buffer.isEncoding('bad'), false);
  });

  test('Buffer.isBuffer', () => {
    equal(Buffer.isBuffer(new Buffer('hey', 'utf8')), true);
    equal(Buffer.isBuffer(new Buffer([1, 2, 3], 'utf8')), true);
    equal(Buffer.isBuffer('hey'), false);
  });

  test('utf8 buffer to base64', () => {
    equal(new Buffer('Ձאab', 'utf8').toString('base64'), '1YHXkGFi');
  });

  test('utf8 buffer to hex', () => {
    equal(new Buffer('Ձאab', 'utf8').toString('hex'), 'd581d7906162');
  });

  test('utf8 to utf8', () => {
    equal(new Buffer('öäüõÖÄÜÕ', 'utf8').toString('utf8'), 'öäüõÖÄÜÕ');
  });

  test('utf16le to utf16', () => {
    equal(new Buffer(new Buffer('abcd', 'utf8').toString('utf16le'), 'utf16le').toString('utf8'), 'abcd');
  });

  test('utf16le to utf16 with odd byte length input', () => {
    equal(new Buffer(new Buffer('abcde', 'utf8').toString('utf16le'), 'utf16le').toString('utf8'), 'abcd');
  });

  test('utf16le to hex', () => {
    equal(new Buffer('abcd', 'utf16le').toString('hex'), '6100620063006400');
  });

  test('ascii buffer to base64', () => {
    equal(new Buffer('123456!@#$%^', 'ascii').toString('base64'), 'MTIzNDU2IUAjJCVe');
  });

  test('ascii buffer to hex', () => {
    equal(new Buffer('123456!@#$%^', 'ascii').toString('hex'), '31323334353621402324255e');
  });

  test('base64 buffer to utf8', () => {
    equal(new Buffer('1YHXkGFi', 'base64').toString('utf8'), 'Ձאab');
  });

  test('hex buffer to utf8', () => {
    equal(new Buffer('d581d7906162', 'hex').toString('utf8'), 'Ձאab');
  });

  test('base64 buffer to ascii', () => {
    equal(new Buffer('MTIzNDU2IUAjJCVe', 'base64').toString('ascii'), '123456!@#$%^');
  });

  test('hex buffer to ascii', () => {
    equal(new Buffer('31323334353621402324255e', 'hex').toString('ascii'), '123456!@#$%^');
  });

  test('base64 buffer to binary', () => {
    equal(new Buffer('MTIzNDU2IUAjJCVe', 'base64').toString('binary'), '123456!@#$%^');
  });

  test('hex buffer to binary', () => {
    equal(new Buffer('31323334353621402324255e', 'hex').toString('binary'), '123456!@#$%^');
  });

  test('utf8 to binary', () => {
    /* jshint -W100 */
    equal(new Buffer('öäüõÖÄÜÕ', 'utf8').toString('binary'), 'Ã¶Ã¤Ã¼ÃµÃÃÃÃ');
    /* jshint +W100 */
  });

  test('utf8 replacement chars (1 byte sequence)', () => {
    equal(new Buffer([0x80]).toString(), '\uFFFD');
    equal(new Buffer([0x7f]).toString(), '\u007F');
  });

  test('utf8 replacement chars (2 byte sequences)', () => {
    equal(new Buffer([0xc7]).toString(), '\uFFFD');
    equal(new Buffer([0xc7, 0xb1]).toString(), '\u01F1');
    equal(new Buffer([0xc0, 0xb1]).toString(), '\uFFFD\uFFFD');
    equal(new Buffer([0xc1, 0xb1]).toString(), '\uFFFD\uFFFD');
  });

  test('utf8 replacement chars (3 byte sequences)', () => {
    equal(new Buffer([0xe0]).toString(), '\uFFFD');
    equal(new Buffer([0xe0, 0xac]).toString(), '\uFFFD\uFFFD');
    equal(new Buffer([0xe0, 0xac, 0xb9]).toString(), '\u0B39');
  });

  test('utf8 replacement chars (4 byte sequences)', () => {
    equal(new Buffer([0xf4]).toString(), '\uFFFD');
    equal(new Buffer([0xf4, 0x8f]).toString(), '\uFFFD\uFFFD');
    equal(new Buffer([0xf4, 0x8f, 0x80]).toString(), '\uFFFD\uFFFD\uFFFD');
    equal(new Buffer([0xf4, 0x8f, 0x80, 0x84]).toString(), '\uDBFC\uDC04');
    equal(new Buffer([0xff]).toString(), '\uFFFD');
    equal(new Buffer([0xff, 0x8f, 0x80, 0x84]).toString(), '\uFFFD\uFFFD\uFFFD\uFFFD');
  });

  test('utf8 replacement chars on 256 random bytes', () => {
    equal(
      new Buffer([
        152, 130, 206, 23, 243, 238, 197, 44, 27, 86, 208, 36, 163, 184, 164, 21, 94, 242, 178, 46, 25, 26, 253, 178,
        72, 147, 207, 112, 236, 68, 179, 190, 29, 83, 239, 147, 125, 55, 143, 19, 157, 68, 157, 58, 212, 224, 150, 39,
        128, 24, 94, 225, 120, 121, 75, 192, 112, 19, 184, 142, 203, 36, 43, 85, 26, 147, 227, 139, 242, 186, 57, 78,
        11, 102, 136, 117, 180, 210, 241, 92, 3, 215, 54, 167, 249, 1, 44, 225, 146, 86, 2, 42, 68, 21, 47, 238, 204,
        153, 216, 252, 183, 66, 222, 255, 15, 202, 16, 51, 134, 1, 17, 19, 209, 76, 238, 38, 76, 19, 7, 103, 249, 5,
        107, 137, 64, 62, 170, 57, 16, 85, 179, 193, 97, 86, 166, 196, 36, 148, 138, 193, 210, 69, 187, 38, 242, 97,
        195, 219, 252, 244, 38, 1, 197, 18, 31, 246, 53, 47, 134, 52, 105, 72, 43, 239, 128, 203, 73, 93, 199, 75, 222,
        220, 166, 34, 63, 236, 11, 212, 76, 243, 171, 110, 78, 39, 205, 204, 6, 177, 233, 212, 243, 0, 33, 41, 122, 118,
        92, 252, 0, 157, 108, 120, 70, 137, 100, 223, 243, 171, 232, 66, 126, 111, 142, 33, 3, 39, 117, 27, 107, 54, 1,
        217, 227, 132, 13, 166, 3, 73, 53, 127, 225, 236, 134, 219, 98, 214, 125, 148, 24, 64, 142, 111, 231, 194, 42,
        150, 185, 10, 182, 163, 244, 19, 4, 59, 135, 16
      ]).toString(),
      '\uFFFD\uFFFD\uFFFD\u0017\uFFFD\uFFFD\uFFFD\u002C\u001B\u0056\uFFFD\u0024\uFFFD\uFFFD\uFFFD\u0015\u005E\uFFFD\uFFFD\u002E\u0019\u001A\uFFFD\uFFFD\u0048\uFFFD\uFFFD\u0070\uFFFD\u0044\uFFFD\uFFFD\u001D\u0053\uFFFD\uFFFD\u007D\u0037\uFFFD\u0013\uFFFD\u0044\uFFFD\u003A\uFFFD\uFFFD\uFFFD\u0027\uFFFD\u0018\u005E\uFFFD\u0078\u0079\u004B\uFFFD\u0070\u0013\uFFFD\uFFFD\uFFFD\u0024\u002B\u0055\u001A\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\u0039\u004E\u000B\u0066\uFFFD\u0075\uFFFD\uFFFD\uFFFD\u005C\u0003\uFFFD\u0036\uFFFD\uFFFD\u0001\u002C\uFFFD\uFFFD\u0056\u0002\u002A\u0044\u0015\u002F\uFFFD\u0319\uFFFD\uFFFD\uFFFD\u0042\uFFFD\uFFFD\u000F\uFFFD\u0010\u0033\uFFFD\u0001\u0011\u0013\uFFFD\u004C\uFFFD\u0026\u004C\u0013\u0007\u0067\uFFFD\u0005\u006B\uFFFD\u0040\u003E\uFFFD\u0039\u0010\u0055\uFFFD\uFFFD\u0061\u0056\uFFFD\uFFFD\u0024\uFFFD\uFFFD\uFFFD\uFFFD\u0045\uFFFD\u0026\uFFFD\u0061\uFFFD\uFFFD\uFFFD\uFFFD\u0026\u0001\uFFFD\u0012\u001F\uFFFD\u0035\u002F\uFFFD\u0034\u0069\u0048\u002B\uFFFD\uFFFD\uFFFD\u0049\u005D\uFFFD\u004B\uFFFD\u0726\u0022\u003F\uFFFD\u000B\uFFFD\u004C\uFFFD\uFFFD\u006E\u004E\u0027\uFFFD\uFFFD\u0006\uFFFD\uFFFD\uFFFD\uFFFD\u0000\u0021\u0029\u007A\u0076\u005C\uFFFD\u0000\uFFFD\u006C\u0078\u0046\uFFFD\u0064\uFFFD\uFFFD\uFFFD\uFFFD\u0042\u007E\u006F\uFFFD\u0021\u0003\u0027\u0075\u001B\u006B\u0036\u0001\uFFFD\uFFFD\uFFFD\u000D\uFFFD\u0003\u0049\u0035\u007F\uFFFD\uFFFD\uFFFD\uFFFD\u0062\uFFFD\u007D\uFFFD\u0018\u0040\uFFFD\u006F\uFFFD\uFFFD\u002A\uFFFD\uFFFD\u000A\uFFFD\uFFFD\uFFFD\u0013\u0004\u003B\uFFFD\u0010'
    );
  });

  test('utf8 replacement chars for anything in the surrogate pair range', () => {
    equal(new Buffer([0xed, 0x9f, 0xbf]).toString(), '\uD7FF');
    equal(new Buffer([0xed, 0xa0, 0x80]).toString(), '\uFFFD\uFFFD\uFFFD');
    equal(new Buffer([0xed, 0xbe, 0x8b]).toString(), '\uFFFD\uFFFD\uFFFD');
    equal(new Buffer([0xed, 0xbf, 0xbf]).toString(), '\uFFFD\uFFFD\uFFFD');
    equal(new Buffer([0xee, 0x80, 0x80]).toString(), '\uE000');
  });

  test("utf8 don't replace the replacement char", () => {
    equal(new Buffer('\uFFFD').toString(), '\uFFFD');
  });

  test.skip('buffer.write("hex") should stop on invalid characters', () => {
    // Test the entire 16-bit space.
    for (let ch = 0; ch <= 0xffff; ch++) {
      // 0-9
      if (ch >= 0x30 && ch <= 0x39) {
        continue;
      }

      // A-F
      if (ch >= 0x41 && ch <= 0x46) {
        continue;
      }

      // a-f
      if (ch >= 0x61 && ch <= 0x66) {
        continue;
      }

      for (const str of [
        'abcd' + String.fromCharCode(ch) + 'ef0',
        'abcde' + String.fromCharCode(ch) + 'f0',
        'abcd' + String.fromCharCode(ch + 0) + String.fromCharCode(ch + 1) + 'f0',
        'abcde' + String.fromCharCode(ch + 0) + String.fromCharCode(ch + 1) + '0'
      ]) {
        const buf = Buffer.alloc(4);
        equal(str.length, 8);
        equal(buf.write(str, 'hex'), 2);
        equal(buf.toString('hex'), 'abcd0000');
        equal(Buffer.from(str, 'hex').toString('hex'), 'abcd');
      }
    }
  });

  test.skip('buffer.write("hex") should truncate odd string lengths', () => {
    const buf = Buffer.alloc(32);
    const charset = '0123456789abcdef';

    let str = '';

    for (let i = 0; i < 63; i++) {
      str += charset[(Math.random() * charset.length) | 0];
    }

    equal(buf.write('abcde', 'hex'), 2);
    equal(buf.toString('hex', 0, 3), 'abcd00');

    buf.fill(0);

    equal(buf.write(str, 'hex'), 31);
    equal(buf.toString('hex', 0, 32), str.slice(0, -1) + '00');
  });

  test('buffer.write string should get parsed as number', () => {
    const b = new Buffer(64);
    b.writeUInt16LE('1003', 0);
    equal(b.readUInt16LE(0), 1003);
  });

  test('buffer.writeUInt8 a fractional number will get Math.floored', () => {
    // Some extra work is necessary to make this test pass with the Object implementation

    const b = new Buffer(1);
    b.writeInt8(5.5, 0);
    equal(b[0], 5);
  });

  test('writeUint8 with a negative number throws', () => {
    const buf = new Buffer(1);

    expect(() => buf.writeUInt8(-3, 0)).toThrow();
  });

  test('large values do not improperly roll over (ref #80)', () => {
    const nums = [-25589992, -633756690, -898146932];
    const out = new Buffer(12);
    out.fill(0);
    out.writeInt32BE(nums[0], 0);
    let newNum = out.readInt32BE(0);
    equal(nums[0], newNum);
    out.writeInt32BE(nums[1], 4);
    newNum = out.readInt32BE(4);
    equal(nums[1], newNum);
    out.writeInt32BE(nums[2], 8);
    newNum = out.readInt32BE(8);
    equal(nums[2], newNum);
  });
});
