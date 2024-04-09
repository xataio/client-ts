import { HostProvider, parseProviderString } from '@xata.io/client';
import { mkdir, readFile, writeFile } from 'fs/promises';
import ini from 'ini';
import { homedir } from 'os';
import path, { dirname } from 'path';
import z from 'zod';

const credentialSchema = z.object({
  api: z.string().optional(),
  web: z.string().optional(),
  apiKey: z.string()
});
const credentialsDictionarySchema = z.record(credentialSchema);

export type Credential = z.infer<typeof credentialSchema>;
export type CredentialsDictionary = z.infer<typeof credentialsDictionarySchema>;

export const credentialsFilePath = path.join(homedir(), '.config', 'xata', 'credentials');

export type Profile = {
  name: string;
  apiKey: string;
  web: string;
  host: HostProvider;
};

export async function readCredentialsDictionary(): Promise<CredentialsDictionary> {
  const content = await readCredentialsFile();
  if (!content) return {};

  const credentials = (() => {
    try {
      return ini.parse(content);
    } catch (err) {
      console.error(`Error parsing credentials file ${err}`);
      return {};
    }
  })();
  if (!credentials) return {};

  const result = credentialsDictionarySchema.safeParse(credentials);
  if (!result.success) {
    console.log(content, credentials);
    console.error(`Malformed credentials file ${result.error}`);
    return {};
  }

  return result.data;
}

async function readCredentialsFile() {
  try {
    return await readFile(credentialsFilePath, 'utf-8');
  } catch (err) {
    return null;
  }
}

export async function hasProfile(profile: string): Promise<boolean> {
  const credentials = await readCredentialsDictionary();
  return !!credentials[profile];
}

async function writeCredentials(credentials: CredentialsDictionary) {
  const dir = dirname(credentialsFilePath);
  await mkdir(dir, { recursive: true });
  await writeFile(credentialsFilePath, ini.stringify(credentials), { mode: 0o600 });
}

export async function setProfile(name: string, profile: Credential) {
  const credentials = await readCredentialsDictionary();
  credentials[name] = {
    apiKey: profile.apiKey,
    ...Object.fromEntries(Object.entries(profile).filter(([, value]) => value))
  };
  await writeCredentials(credentials);
}

export async function removeProfile(name: string) {
  const credentials = await readCredentialsDictionary();
  if (credentials[name]) delete credentials[name];
  await writeCredentials(credentials);
}

export function getEnvProfileName() {
  return process.env.XATA_PROFILE || 'default';
}

export function buildProfile(base: Partial<Credential> & { name: string }): Profile {
  return {
    name: base.name,
    apiKey: base.apiKey ?? process.env.XATA_API_KEY ?? '',
    web: base.web ?? process.env.XATA_WEB_URL ?? 'https://app.xata.io',
    host: parseProviderString(base.api ?? process.env.XATA_API_PROVIDER) ?? 'production'
  };
}
