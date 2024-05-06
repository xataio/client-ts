import { buildClient } from '@xata.io/client';
import dotenv from 'dotenv';
import { join } from 'path';
import { XataImportPlugin } from '../src/plugin';
import { ToBoolean } from '../src/types';

export const yepNopeToBoolean: ToBoolean = (value) => {
  if (value === 'yep') {
    return true;
  }
  if (value === 'nope') {
    return false;
  }
  return null;
};

export const getXataClientWithPlugin = () => {
  // Get environment variables before reading them
  dotenv.config({ path: join(process.cwd(), '.env') });

  const XataClient = buildClient({
    import: new XataImportPlugin()
  });

  return new XataClient({
    apiKey: 'xau_test123',
    databaseURL: 'https://my-workspace-v0fo9s.us-east-1.xata.sh/db/mydb',
    branch: 'main'
  });
};
