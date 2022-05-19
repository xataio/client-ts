import { spinner } from './spinner';

export function exitWithError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (spinner) spinner.fail(message);
  else console.error(message);
  process.exit(1);
}
