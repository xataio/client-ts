import crypto from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import url from 'url';
import { describe, expect, test, vi } from 'vitest';
import { generateKeys, generateURL, handler } from './auth-server.js';

const port = 1234;
const { publicKey, privateKey, passphrase } = generateKeys();

describe('generateURL', () => {
  test('generates a URL', async () => {
    const uiURL = generateURL(port, publicKey);

    expect(uiURL.startsWith('https://app.xata.io/new-api-key?')).toBe(true);

    const parsed = url.parse(uiURL, true);
    const { pub, name, redirect } = parsed.query;

    expect(pub).toBeDefined();
    expect(name).toEqual('Xata CLI');
    expect(redirect).toEqual('http://localhost:1234');
  });
});

describe('handler', () => {
  test('405s if the method is not GET', async () => {
    const callback = vi.fn();
    const httpHandler = handler(publicKey, privateKey, passphrase, callback);

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

  test('redirects if the path is /new', async () => {
    const callback = vi.fn();
    const httpHandler = handler(publicKey, privateKey, passphrase, callback);

    const writeHead = vi.fn();
    const req = { method: 'GET', url: '/new', socket: { localPort: 9999 } } as unknown as IncomingMessage;
    const res = {
      writeHead,
      end: vi.fn()
    } as unknown as ServerResponse;

    httpHandler(req, res);

    const [status, headers] = writeHead.mock.calls[0];
    expect(status).toEqual(302);
    expect(String(headers.location).startsWith('https://app.xata.io/new-api-key?pub=')).toBeTruthy();
    expect(String(headers.location).includes('9999')).toBeTruthy();
    expect(res.end).toHaveBeenCalledWith();
    expect(callback).not.toHaveBeenCalled();
  });

  test('404s if the path is not the root path', async () => {
    const callback = vi.fn();
    const httpHandler = handler(publicKey, privateKey, passphrase, callback);

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
    const httpHandler = handler(publicKey, privateKey, passphrase, callback);

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
    const httpHandler = handler(publicKey, privateKey, passphrase, callback);

    const req = { method: 'GET', url: '/?key=malformed-key' } as unknown as IncomingMessage;
    const res = {
      writeHead: vi.fn(),
      end: vi.fn()
    } as unknown as ServerResponse;

    httpHandler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(500);
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('Something went wrong:'));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('decoding error'));
    expect(callback).not.toHaveBeenCalled();
  });

  test('receives the API key if everything is fine', async () => {
    const callback = vi.fn();
    const httpHandler = handler(publicKey, privateKey, passphrase, callback);
    const apiKey = 'abcdef1234';
    const encryptedKey = crypto.publicEncrypt(publicKey, Buffer.from(apiKey));

    const end = vi.fn();
    const req = {
      method: 'GET',
      url: `/?key=${encodeURIComponent(encryptedKey.toString('base64'))}`,
      destroy: vi.fn()
    } as unknown as IncomingMessage;
    const res = {
      writeHead: vi.fn(),
      end
    } as unknown as ServerResponse;

    httpHandler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, {
      'Content-Type': 'text/html'
    });
    expect(end.mock.calls[0][0]).toContain('Congratulations, you are all set!');
    expect(req.destroy).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(apiKey);
  });
});
