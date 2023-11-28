import chalk from 'chalk';
import crypto from 'crypto';
import { readFileSync } from 'fs';
import http from 'http';
import { AddressInfo } from 'net';
import open from 'open';
import path, { dirname } from 'path';
import url, { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expires: z.string()
});

type OAuthResponse = z.infer<typeof ResponseSchema>;

export function handler({
  domain,
  publicKey,
  privateKey,
  passphrase,
  callback
}: {
  domain: string;
  publicKey: string;
  privateKey: string;
  passphrase: string;
  callback: (response: OAuthResponse) => void;
}) {
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
          location: generateURL({ port, publicKey, domain })
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
      const response = crypto
        .privateDecrypt(privKey, Buffer.from(String(parsedURL.query.key).replace(/ /g, '+'), 'base64'))
        .toString('utf8');
      renderSuccessPage(req, res, String(parsedURL.query['color-mode']));
      req.destroy();
      callback(ResponseSchema.parse(JSON.parse(response)));
    } catch (err) {
      res.writeHead(500);
      res.end(`Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
}

function renderSuccessPage(_req: http.IncomingMessage, res: http.ServerResponse, colorMode: string) {
  res.writeHead(200, {
    'Content-Type': 'text/html'
  });
  const html = readFileSync(path.join(__dirname, 'api-key-success.html'), 'utf-8');
  res.end(html.replace('data-color-mode=""', `data-color-mode="${colorMode}"`));
}

export function generateURL({ port, publicKey, domain }: { port: number; publicKey: string; domain: string }) {
  const name = 'Xata CLI';
  const serverRedirect = `${domain}/api/integrations/cli/callback`;
  const cliRedirect = `http://localhost:${port}`;
  const pub = publicKey
    .replace(/\n/g, '')
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '');

  const url = new URL(`${domain}/integrations/oauth/authorize`);
  url.searchParams.set('client_id', 'b7msdmpun91q33vpihpk3vs39g');
  url.searchParams.set('redirect_uri', serverRedirect);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'admin:all');
  url.searchParams.set(
    'state',
    Buffer.from(JSON.stringify({ name, pub, cliRedirect, serverRedirect })).toString('base64')
  );
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

export async function loginWithWebUI(domain: string) {
  const { publicKey, privateKey, passphrase } = generateKeys();

  return new Promise<OAuthResponse>((resolve) => {
    const server = http.createServer(
      handler({
        domain,
        publicKey,
        privateKey,
        passphrase,
        callback: (credentials) => {
          resolve(credentials);
          server.close();
        }
      })
    );
    server.listen(() => {
      const { port } = server.address() as AddressInfo;
      const openURL = generateURL({ port, publicKey, domain });
      console.log(
        `We are opening your default browser. If your browser doesn't open automatically, please copy and paste the following URL into your browser: ${chalk.bold(
          `http://localhost:${port}/new`
        )}`
      );
      open(openURL).catch(console.error);
    });
  });
}

export async function refreshAccessToken(domain: string, refreshToken: string) {
  const response = await fetch(`${domain}/api/integrations/cli/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh access token: ${response.status} ${response.statusText}`);
  }

  return ResponseSchema.parse(await response.json());
}
