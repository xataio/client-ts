import { isObject, isString } from './lang';

export function getEnvVariable(name: string): string | undefined {
  // Node.js: process.env
  try {
    if (isObject(process) && isString(process?.env?.[name])) {
      return process.env[name];
    }
  } catch (err) {
    // Ignore: Should never happen
  }

  try {
    // Deno: Deno.env.get
    if (isObject(Deno) && isString(Deno?.env?.get(name))) {
      return Deno.env.get(name);
    }
  } catch (err) {
    // Ignore: Will fail if not using --allow-env
  }
}

export async function getGitBranch(): Promise<string | undefined> {
  // Node.js: child_process.execSync
  try {
    if (isObject(process)) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('child_process').execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    }
  } catch (err) {
    // Ignore
  }

  // Deno: Deno.run
  try {
    if (isObject(Deno)) {
      const process = Deno.run({
        cmd: ['git', 'branch', '--show-current'],
        stdout: 'piped',
        stderr: 'piped'
      });
      return new TextDecoder().decode(await process.output()).trim();
    }
  } catch (err) {
    // Ignore: Will fail if not using --allow-run
  }
}
