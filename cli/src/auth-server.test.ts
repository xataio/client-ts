import { IncomingMessage, ServerResponse } from 'http';
import { describe, expect, test, vi } from 'vitest';
import { generateURL, handler } from './auth-server.js';
import { Mock } from 'ts-mockery';

const port = 1234;

describe('generateURL', () => {
  test('generates a URL', async () => {
    expect(generateURL(port, 'mykey')).toBe(
      `https://app.xata.io/new-api-key?pub=mykey&name=Xata%20CLI&redirect=http%3A%2F%2Flocalhost%3A1234`
    );
  });
});

describe('handler', () => {
  test('405s if the method is not GET', async () => {
    const callback = vi.fn();
    const decrypt = vi.fn();
    const httpHandler = handler(decrypt, callback);

    const req = Mock.of<IncomingMessage>({ method: 'POST', url: '/' });
    const res = Mock.of<ServerResponse>({
      writeHead: vi.fn(),
      end: vi.fn()
    });

    httpHandler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(405);
    expect(res.end).toHaveBeenCalledWith();
    expect(callback).not.toHaveBeenCalled();
  });

  test('404s if the path is not the root path', async () => {
    const callback = vi.fn();
    const decrypt = vi.fn();
    const httpHandler = handler(decrypt, callback);

    const req = Mock.of<IncomingMessage>({ method: 'GET', url: '/foo' });
    const res = Mock.of<ServerResponse>({
      writeHead: vi.fn(),
      end: vi.fn()
    });

    httpHandler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(404);
    expect(res.end).toHaveBeenCalledWith();
    expect(callback).not.toHaveBeenCalled();
  });

  test('returns 400 if resource is called with the wrong parameters', async () => {
    const callback = vi.fn();
    const decrypt = vi.fn();
    const httpHandler = handler(decrypt, callback);

    const req = Mock.of<IncomingMessage>({ method: 'GET', url: '/' });
    const res = Mock.of<ServerResponse>({
      writeHead: vi.fn(),
      end: vi.fn()
    });

    httpHandler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400);
    expect(res.end).toHaveBeenCalledWith('Missing key parameter');
    expect(callback).not.toHaveBeenCalled();
  });

  test('handles errors correctly', async () => {
    const callback = vi.fn();
    const decrypt = vi.fn(() => Promise.reject('booom!'));
    const httpHandler = handler(decrypt, callback);

    const req = Mock.of<IncomingMessage>({ method: 'GET', url: '/?key=malformed-key' });
    const res = Mock.of<ServerResponse>({
      writeHead: vi.fn(),
      end: vi.fn()
    });

    httpHandler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(500);
    expect(res.end).toHaveBeenCalledWith('Something went wrong: boom');
    expect(callback).not.toHaveBeenCalled();
  });

  test('receives the API key if everything is fine', async () => {
    const callback = vi.fn();
    const decrypt = vi.fn(() => Promise.resolve('mykey'));
    const httpHandler = handler(decrypt, callback);

    const end = vi.fn();
    const req = Mock.of<IncomingMessage>({
      method: 'GET',
      url: `/?key=encrypted`,
      destroy: vi.fn()
    });
    const res = Mock.of<ServerResponse>({
      writeHead: vi.fn(),
      end
    });

    httpHandler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, {
      'Content-Type': 'text/html'
    });
    expect(end.mock.calls[0][0]).toContain('Congratulations, you are all set!');
    expect(req.destroy).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith('mykey');
  });
});
