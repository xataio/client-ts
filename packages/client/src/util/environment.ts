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
  // Fallback values read from global variables
  const fallbackValues = {
    apiKey: XATA_API_KEY,
    databaseURL: XATA_DATABASE_URL,
    branch: XATA_BRANCH ?? VERCEL_GIT_COMMIT_REF ?? CF_PAGES_BRANCH ?? BRANCH,
    fallbackBranch: XATA_FALLBACK_BRANCH
  };

  // Node.js: process.env
  try {
    if (isObject(process) && isObject(process.env)) {
      return {
        apiKey: process.env.XATA_API_KEY ?? fallbackValues.apiKey,
        databaseURL: process.env.XATA_DATABASE_URL ?? fallbackValues.databaseURL,
        branch:
          process.env.XATA_BRANCH ??
          process.env.VERCEL_GIT_COMMIT_REF ??
          process.env.CF_PAGES_BRANCH ??
          process.env.BRANCH ??
          fallbackValues.branch,
        fallbackBranch: process.env.XATA_FALLBACK_BRANCH ?? fallbackValues.fallbackBranch
      };
    }
  } catch (err) {
    // Ignore: Should never happen
  }

  try {
    // Deno: Deno.env.get
    if (isObject(Deno) && isObject(Deno.env)) {
      return {
        apiKey: Deno.env.get('XATA_API_KEY') ?? fallbackValues.apiKey,
        databaseURL: Deno.env.get('XATA_DATABASE_URL') ?? fallbackValues.databaseURL,
        branch:
          Deno.env.get('XATA_BRANCH') ??
          Deno.env.get('VERCEL_GIT_COMMIT_REF') ??
          Deno.env.get('CF_PAGES_BRANCH') ??
          Deno.env.get('BRANCH') ??
          fallbackValues.branch,
        fallbackBranch: Deno.env.get('XATA_FALLBACK_BRANCH') ?? fallbackValues.fallbackBranch
      };
    }
  } catch (err) {
    // Ignore: Will fail if not using --allow-env
  }

  return fallbackValues;
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
