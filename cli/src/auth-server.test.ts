import crypto from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import url from 'url';
import { describe, expect, test, vi } from 'vitest';
import { generateKeys, generateURL, handler } from './auth-server.js';

const port = 1234;
const { publicKey, privateKey, passphrase } = generateKeys();

describe('generateURL', () => {
  test('generates a URL', async () => {
    const uiURL = generateURL(port, publicKey, privateKey, passphrase);

    expect(uiURL.startsWith('https://app.xata.io/new-api-key?')).toBe(true);

    const parsed = url.parse(uiURL, true);
    const { pub, info } = parsed.query;

    const pk = crypto.createPublicKey(
      `-----BEGIN PUBLIC KEY-----\n${String(pub).replace(/ /g, '+')}\n-----END PUBLIC KEY-----`
    );
    const appInfo = JSON.parse(
      crypto.publicDecrypt(pk, Buffer.from(String(info).replace(/ /g, '+'), 'base64')).toString('utf-8')
    );

    expect(appInfo).toMatchInlineSnapshot(`
      {
        "name": "Xata CLI",
        "redirect": "http://localhost:1234",
      }
    `);
  });
});

describe('handler', () => {
  test('405s if the method is not GET', async () => {
    const callback = vi.fn();
    const httpHandler = handler(privateKey, passphrase, callback);

    const req = { method: 'POST', url: '/' } as unknown as IncomingMessage;
    const res = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse;

    httpHandler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(405);
    expect(res.end).toHaveBeenCalledWith();
    expect(callback).not.toHaveBeenCalled();
  });

  test('404s if the path is not the root path', async () => {
    const callback = vi.fn();
    const httpHandler = handler(privateKey, passphrase, callback);

    const req = { method: 'GET', url: '/foo' } as unknown as IncomingMessage;
    const res = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse;

    httpHandler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(404);
    expect(res.end).toHaveBeenCalledWith();
    expect(callback).not.toHaveBeenCalled();
  });

  test('returns 400 if resource is called with the wrong parameters', async () => {
    const callback = vi.fn();
    const httpHandler = handler(privateKey, passphrase, callback);

    const req = { method: 'GET', url: '/' } as unknown as IncomingMessage;
    const res = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse;

    httpHandler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400);
    expect(res.end).toHaveBeenCalledWith('Missing key parameter');
    expect(callback).not.toHaveBeenCalled();
  });

  test('hadles errors correctly', async () => {
    const callback = vi.fn();
    const httpHandler = handler(privateKey, passphrase, callback);

    const req = { method: 'GET', url: '/?key=malformed-key' } as unknown as IncomingMessage;
    const res = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse;

    httpHandler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(500);
    expect(res.end).toHaveBeenCalledWith(
      'Something went wrong: error:04099079:rsa routines:RSA_padding_check_PKCS1_OAEP_mgf1:oaep decoding error'
    );
    expect(callback).not.toHaveBeenCalled();
  });

  test('receives the API key if everything is fine', async () => {
    const callback = vi.fn();
    const httpHandler = handler(privateKey, passphrase, callback);
    const apiKey = 'abcdef1234';
    const encryptedKey = crypto.publicEncrypt(publicKey, Buffer.from(apiKey));

    const req = {
      method: 'GET',
      url: `/?key=${encodeURIComponent(encryptedKey.toString('base64'))}`
    } as unknown as IncomingMessage;
    const res = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse;

    httpHandler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalledWith('You are all set! You can close this tab now');
    expect(callback).toHaveBeenCalledWith(apiKey);
  });
});
