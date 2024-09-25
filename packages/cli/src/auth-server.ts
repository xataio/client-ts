import chalk from 'chalk';
import crypto from 'crypto';
import { readFileSync } from 'fs';
import http from 'http';
import { AddressInfo } from 'net';
import open from 'open';
import path, { dirname } from 'path';
import url, { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function handler(
  webHost: string,
  publicKey: string,
  privateKey: string,
  passphrase: string,
  callback: (apiKey: string) => void
) {
  return (req: http.IncomingMessage, res: http.ServerResponse) => {
    try {
      if (req.method !== 'GET') {
        res.writeHead(405);
        return res.end();
      }

      const parsedURL = url.parse(req.url ?? '', true);
      if (parsedURL.pathname === '/new') {
        const port = req.socket.localPort ?? 80;
        res.writeHead(302, {
          location: generateURL(webHost, port, publicKey)
        });
        res.end();
        return;
      }

      if (parsedURL.pathname !== '/') {
        res.writeHead(404);
        return res.end();
      }
      if (!parsedURL.query.key) {
        res.writeHead(400);
        return res.end('Missing key parameter');
      }
      const privKey = crypto.createPrivateKey({ key: privateKey, passphrase });
      const apiKey = crypto
        .privateDecrypt(privKey, Buffer.from(String(parsedURL.query.key).replace(/ /g, '+'), 'base64'))
        .toString('utf8');
      renderSuccessPage(req, res, String(parsedURL.query['color-mode']));
      req.destroy();
      callback(apiKey);
    } catch (err) {
      res.writeHead(500);
      console.error(err);
      res.end('Something went wrong');
    }
  };
}

function renderSuccessPage(req: http.IncomingMessage, res: http.ServerResponse, colorMode: string) {
  res.writeHead(200, {
    'Content-Type': 'text/html'
  });
  const html = readFileSync(path.join(__dirname, 'api-key-success.html'), 'utf-8');
  res.end(html.replace('data-color-mode=""', `data-color-mode="${colorMode}"`));
}

export function generateURL(webHost: string, port: number, publicKey: string) {
  const pub = publicKey
    .replace(/\n/g, '')
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '');
  const name = 'Xata CLI';
  const redirect = `http://localhost:${port}`;
  const url = new URL(`${webHost}/new-api-key`);
  url.searchParams.append('pub', pub);
  url.searchParams.append('name', name);
  url.searchParams.append('redirect', redirect);
  return url.toString();
}

export function generateKeys() {
  const passphrase = crypto.randomBytes(32).toString('hex');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
      cipher: 'aes-256-cbc',
      passphrase
    }
  });
  return { publicKey, privateKey, passphrase };
}

export async function createAPIKeyThroughWebUI(webHost: string) {
  const { publicKey, privateKey, passphrase } = generateKeys();

  return new Promise<string>((resolve) => {
    const server = http.createServer(
      handler(webHost, publicKey, privateKey, passphrase, (apiKey) => {
        resolve(apiKey);
        server.close();
      })
    );
    server.listen(() => {
      const { port } = server.address() as AddressInfo;
      const openURL = generateURL(webHost, port, publicKey);
      console.log(
        `We are opening your default browser. If your browser doesn't open automatically, please copy and paste the following URL into your browser: ${chalk.bold(
          `http://localhost:${port}/new`
        )}`
      );
      open(openURL).catch(console.error);
    });
  });
}
