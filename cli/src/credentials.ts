import { getAPIKey } from '@xata.io/client';
import { mkdir, readFile, writeFile } from 'fs/promises';
import ini from 'ini';
import { homedir } from 'os';
import path, { dirname } from 'path';
import z from 'zod';

const profileSchema = z.object({
  api: z.string().optional(),
  web: z.string().optional(),
  apiKey: z.string()
});

const credentialsSchema = z.record(profileSchema);

export type Profile = z.infer<typeof profileSchema>;
export type Credentials = z.infer<typeof credentialsSchema>;

export const credentialsPath = path.join(homedir(), '.config', 'xata', 'credentials');

export async function getProfile(ignoreEnv?: boolean): Promise<Profile | undefined> {
  const apiKey = getAPIKey();
  if (!ignoreEnv && !process.env.XATA_PROFILE && apiKey) return { apiKey };

  const credentials = await readCredentials();
  return credentials[getProfileName()];
}

export async function readCredentials(): Promise<Credentials> {
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
    return await readFile(credentialsPath, 'utf-8');
  } catch (err) {
    return null;
  }
}

export async function writeCredentials(credentials: Credentials) {
  const dir = dirname(credentialsPath);
  await mkdir(dir, { recursive: true });
  await writeFile(credentialsPath, ini.stringify(credentials), { mode: 0o600 });
}

export async function setProfile(profile: Profile) {
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
