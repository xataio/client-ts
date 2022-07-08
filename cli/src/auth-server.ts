import { readFileSync } from 'fs';
import http from 'http';
import { AddressInfo } from 'net';
import open from 'open';
import path, { dirname } from 'path';
import url, { fileURLToPath } from 'url';
import { webcrypto } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function handler(decrypt: CryptoAdapter['decrypt'], callback: (apiKey: string) => void) {
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
      if (typeof parsedURL.query.key !== 'string') {
        res.writeHead(400);
        return res.end('Missing key parameter');
      }

      decrypt(parsedURL.query.key)
        .then((apiKey) => {
          renderSuccessPage(req, res);
          req.destroy();
          callback(apiKey);
        })
        .catch((e) => {
          throw e;
        });
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

export function generateURL(port: number, publicKey: string) {
  return `https://app.xata.io/new-api-key?pub=${encodeURIComponent(publicKey)}&name=${encodeURIComponent(
    'Xata CLI'
  )}&redirect=${encodeURIComponent(`http://localhost:${port}`)}`;
}

export async function createAPIKeyThroughWebUI() {
  const crypto = new CryptoAdapter((webcrypto as any).subtle); // Not typed properly
  await crypto.generateKeys();
  const pub = await crypto.getPublicKey();

  return new Promise<string>((resolve) => {
    const server = http.createServer(
      handler(crypto.decrypt, (apiKey) => {
        resolve(apiKey);
        server.close();
      })
    );
    server.listen(() => {
      const { port } = server.address() as AddressInfo;
      const openURL = generateURL(port, pub);
      open(openURL).catch(() => {
        console.log(`Please open ${openURL} in your browser`);
      });
    });
  });
}

class CryptoAdapter {
  private publicKey: CryptoKey | undefined;
  private privateKey: CryptoKey | undefined;

  constructor(private subtle: SubtleCrypto) {}

  async generateKeys() {
    const keys = await this.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true,
      ['encrypt', 'decrypt']
    );

    this.publicKey = keys.publicKey;
    this.privateKey = keys.privateKey;
  }

  async getPublicKey() {
    if (!this.publicKey) {
      throw new Error('Public key not available, please call `generateKeys() first`');
    }
    const exported = await this.subtle.exportKey('spki', this.publicKey);

    return this.ab2str(exported);
  }

  async decrypt(data: string): Promise<string> {
    if (!this.privateKey) {
      throw new Error('Private key not available, please call `generateKeys() first`');
    }

    const decrypted = await this.subtle.decrypt(
      { name: 'RSA-OAEP' },
      this.privateKey,
      Buffer.from(data.replace(/ /g, '+'), 'base64')
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  }

  /*
   * Convert an ArrayBuffer into a string
   * from https://developer.chrome.com/blog/how-to-convert-arraybuffer-to-and-from-string/
   **/
  private ab2str(buf: ArrayBuffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }
}
