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

export function handler(privateKey: string, passphrase: string, callback: (apiKey: string) => void) {
  return (req: http.IncomingMessage, res: http.ServerResponse) => {
    try {
      if (req.method !== 'GET') {
        res.writeHead(405);
        return res.end();
      }

      const parsedURL = url.parse(req.url ?? '', true);
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
      renderSuccessPage(req, res);
      req.destroy();
      callback(apiKey);
    } catch (err) {
      res.writeHead(500);
      res.end(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
}

function renderSuccessPage(req: http.IncomingMessage, res: http.ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/html'
  });
  res.end(readFileSync(path.join(__dirname, 'api-key-success.html'), 'utf-8'));
}

export function generateURL(port: number, publicKey: string, privateKey: string, passphrase: string) {
  const pub = publicKey
    .replace(/\n/g, '')
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '');
  const data = Buffer.from(JSON.stringify({ name: 'Xata CLI', redirect: `http://localhost:${port}` }));
  const info = crypto.privateEncrypt({ key: privateKey, passphrase }, data).toString('base64');
  return `https://app.xata.io/new-api-key?pub=${encodeURIComponent(pub)}&info=${encodeURIComponent(info)}`;
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

export async function createAPIKeyThroughWebUI() {
  const { publicKey, privateKey, passphrase } = generateKeys();

  return new Promise<string>((resolve) => {
    const server = http.createServer(
      handler(privateKey, passphrase, (apiKey) => {
        resolve(apiKey);
        server.close();
      })
    );
    server.listen(() => {
      const { port } = server.address() as AddressInfo;
      const openURL = generateURL(port, publicKey, privateKey, passphrase);
      const printURL = () => {
        console.log(
          `We are opening your default browser. If your browser doesn't open automatically, please copy and paste the following URL into your browser:`,
          chalk.bold(openURL)
        );
      };

      // Wait so we can get an exitCode. If the proces is still running exitCode is null
      open(openURL, { wait: true })
        .then((proc) => {
          if (proc.exitCode !== null && proc.exitCode > 0) printURL();
        })
        .catch(printURL);
    });
  });
}
