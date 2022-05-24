import { getDatabaseURL } from '@xata.io/client';

export function parseDatabaseURL(databaseURL?: string) {
  databaseURL = databaseURL || getDatabaseURL() || '';
  const [protocol, , host, , database] = databaseURL.split('/');
  const [workspace] = (host || '').split('.');
  return {
    protocol,
    host,
    database,
    workspace
  };
}
