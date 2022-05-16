import { getEnvVariable } from './environment';

export function getAPIKey() {
  try {
    return getEnvVariable('XATA_API_KEY') ?? XATA_API_KEY;
  } catch (err) {
    return undefined;
  }
}
