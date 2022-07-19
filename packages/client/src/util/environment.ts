// eslint-disable-next-line @typescript-eslint/triple-slash-reference
///<reference path="../types/global-node.d.ts"/>
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
///<reference path="../types/global-variables.d.ts"/>
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
///<reference path="../types/global-deno.d.ts"/>

import { isObject } from './lang';

interface Environment {
  apiKey: string | undefined;
  databaseURL: string | undefined;
  branch: string | undefined;
  fallbackBranch: string | undefined;
}

export function getEnvironment(): Environment {
  // Node.js: process.env
  try {
    if (isObject(process) && isObject(process.env)) {
      return {
        apiKey: process.env.XATA_API_KEY ?? getGlobalApiKey(),
        databaseURL: process.env.XATA_DATABASE_URL ?? getGlobalDatabaseURL(),
        branch:
          process.env.XATA_BRANCH ??
          process.env.VERCEL_GIT_COMMIT_REF ??
          process.env.CF_PAGES_BRANCH ??
          process.env.BRANCH ??
          getGlobalBranch(),
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
        branch:
          Deno.env.get('XATA_BRANCH') ??
          Deno.env.get('VERCEL_GIT_COMMIT_REF') ??
          Deno.env.get('CF_PAGES_BRANCH') ??
          Deno.env.get('BRANCH') ??
          getGlobalBranch(),
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
    fallbackBranch: getGlobalFallbackBranch()
  };
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
  // Node.js: child_process.execSync
  try {
    if (typeof require === 'function') {
      const req = require; // Avoid "Detected a Node builtin module import while Node compatibility is disabled" in CloudFlare Workers
      return req('child_process').execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
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
