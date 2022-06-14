import http from 'http';
import { AddressInfo } from 'net';
import open from 'open';
import url from 'url';
import crypto from 'crypto';

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
      res.writeHead(200);
      res.end('You are all set! You can close this tab now');
      callback(apiKey);
    } catch (err) {
      res.writeHead(500);
      res.end(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
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
      open(openURL).catch(() => {
        console.log(`Please open ${openURL} in your browser`);
      });
    });
  });
}
