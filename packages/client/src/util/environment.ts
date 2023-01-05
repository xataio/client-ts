// eslint-disable-next-line @typescript-eslint/triple-slash-reference
///<reference path="../types/global-node.d.ts"/>
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
///<reference path="../types/global-variables.d.ts"/>
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
///<reference path="../types/global-deno.d.ts"/>

import { isDefined, isObject } from './lang';

interface Environment {
  apiKey: string | undefined;
  databaseURL: string | undefined;
  branch: string | undefined;
  envBranch: string | undefined;
  fallbackBranch: string | undefined;
}

export function getEnvironment(): Environment {
  // Node.js: process.env
  try {
    // Not using typeof process.env === 'object' because it's not working in some environments like Bun
    if (isDefined(process) && isDefined(process.env)) {
      return {
        apiKey: process.env.XATA_API_KEY ?? getGlobalApiKey(),
        databaseURL: process.env.XATA_DATABASE_URL ?? getGlobalDatabaseURL(),
        branch: process.env.XATA_BRANCH ?? getGlobalBranch(),
        envBranch: process.env.VERCEL_GIT_COMMIT_REF ?? process.env.CF_PAGES_BRANCH ?? process.env.BRANCH,
        fallbackBranch: process.env.XATA_FALLBACK_BRANCH ?? getGlobalFallbackBranch()
      };
    }
  } catch (err) {
    // Ignore: Should never happen
  }

  try {
    // Deno: Deno.env.get
    if (isObject(Deno) && isObject(Deno.env)) {
      return {
        apiKey: Deno.env.get('XATA_API_KEY') ?? getGlobalApiKey(),
        databaseURL: Deno.env.get('XATA_DATABASE_URL') ?? getGlobalDatabaseURL(),
        branch: Deno.env.get('XATA_BRANCH') ?? getGlobalBranch(),
        envBranch: Deno.env.get('VERCEL_GIT_COMMIT_REF') ?? Deno.env.get('CF_PAGES_BRANCH') ?? Deno.env.get('BRANCH'),
        fallbackBranch: Deno.env.get('XATA_FALLBACK_BRANCH') ?? getGlobalFallbackBranch()
      };
    }
  } catch (err) {
    // Ignore: Will fail if not using --allow-env
  }

  return {
    apiKey: getGlobalApiKey(),
    databaseURL: getGlobalDatabaseURL(),
    branch: getGlobalBranch(),
    envBranch: undefined,
    fallbackBranch: getGlobalFallbackBranch()
  };
}

export function getEnableBrowserVariable() {
  try {
    if (isObject(process) && isObject(process.env) && process.env.XATA_ENABLE_BROWSER !== undefined) {
      return process.env.XATA_ENABLE_BROWSER === 'true';
    }
  } catch (err) {
    // Ignore: Should never happen
  }

  try {
    if (isObject(Deno) && isObject(Deno.env) && Deno.env.get('XATA_ENABLE_BROWSER') !== undefined) {
      return Deno.env.get('XATA_ENABLE_BROWSER') === 'true';
    }
  } catch (err) {
    // Ignore: Will fail if not using --allow-env
  }

  try {
    return XATA_ENABLE_BROWSER === true || XATA_ENABLE_BROWSER === 'true';
  } catch (err) {
    return undefined;
  }
}

function getGlobalApiKey(): string | undefined {
  try {
    return XATA_API_KEY;
  } catch (err) {
    return undefined;
  }
}

function getGlobalDatabaseURL(): string | undefined {
  try {
    return XATA_DATABASE_URL;
  } catch (err) {
    return undefined;
  }
}

function getGlobalBranch(): string | undefined {
  try {
    return XATA_BRANCH;
  } catch (err) {
    return undefined;
  }
}

function getGlobalFallbackBranch(): string | undefined {
  try {
    return XATA_FALLBACK_BRANCH;
  } catch (err) {
    return undefined;
  }
}

export async function getGitBranch(): Promise<string | undefined> {
  const cmd = ['git', 'branch', '--show-current'];
  const fullCmd = cmd.join(' ');

  // Avoid "Detected a Node builtin module import while Node compatibility is disabled" in CloudFlare Workers
  const nodeModule = ['child', 'process'].join('_');

  const execOptions = { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] };

  // Node.js: child_process.execSync
  try {
    /* REMOVE_ESM_BUNDLE_START */
    if (typeof require === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require(nodeModule).execSync(fullCmd, execOptions).trim();
    }
    /* REMOVE_ESM_BUNDLE_END */

    /* REMOVE_CJS_BUNDLE_START */
    const { execSync } = await import(nodeModule);
    return execSync(fullCmd, execOptions).toString().trim();
    /* REMOVE_CJS_BUNDLE_END */
  } catch (err) {
    // Ignore
  }

  // Deno: Deno.run
  try {
    if (isObject(Deno)) {
      const process = Deno.run({ cmd, stdout: 'piped', stderr: 'null' });
      return new TextDecoder().decode(await process.output()).trim();
    }
  } catch (err) {
    // Ignore: Will fail if not using --allow-run
  }
}
