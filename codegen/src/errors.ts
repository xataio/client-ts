import { spinner } from './spinner.js';

export function exitWithError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (spinner) spinner.fail(message);
  else console.error(spinner);
  process.exit(1);
}
