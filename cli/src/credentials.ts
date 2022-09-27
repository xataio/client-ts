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
const credentialsSchema = z.record(credentialSchema);

export type Credential = z.infer<typeof credentialSchema>;
export type CredentialsDictionary = z.infer<typeof credentialsSchema>;

export const credentialsFilePath = path.join(homedir(), '.config', 'xata', 'credentials');

export type Profile = {
  apiKey: string;
  web: string;
  host: HostProvider;
};

export async function readCredentials(): Promise<CredentialsDictionary> {
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

  const result = credentialsSchema.safeParse(credentials);
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

export async function writeCredentials(credentials: CredentialsDictionary) {
  const dir = dirname(credentialsFilePath);
  await mkdir(dir, { recursive: true });
  await writeFile(credentialsFilePath, ini.stringify(credentials), { mode: 0o600 });
}

export async function setProfile(profile: Credential) {
  const credentials = await readCredentials();
  credentials[getProfileName()] = profile;
  await writeCredentials(credentials);
}

export async function removeProfile() {
  const credentials = await readCredentials();
  delete credentials[getProfileName()];
  await writeCredentials(credentials);
}

export function getProfileName() {
  return process.env.XATA_PROFILE || 'default';
}

export function buildProfile(base: Partial<Credential>): Profile {
  return {
    apiKey: base.apiKey ?? process.env.XATA_API_KEY ?? '',
    web: base.web ?? process.env.XATA_WEB_URL ?? '',
    host: parseProviderString(base.api ?? process.env.XATA_API_PROVIDER) ?? 'production'
  };
}
