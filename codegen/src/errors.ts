import { spinner } from './spinner.js';

export function exitWithError(err: unknown) {
  spinner.fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
