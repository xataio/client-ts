import { getEnvironment } from './environment';

export function getAPIKey() {
  try {
    const { apiKey } = getEnvironment();
    return apiKey;
  } catch (err) {
    return undefined;
  }
}
