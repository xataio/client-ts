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
        envBranch: process.env.VERCEL_GIT_COMMIT_REF ?? process.env.CF_PAGES_BRANCH ?? process.env.BRANCH
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
        envBranch: Deno.env.get('VERCEL_GIT_COMMIT_REF') ?? Deno.env.get('CF_PAGES_BRANCH') ?? Deno.env.get('BRANCH')
      };
    }
  } catch (err) {
    // Ignore: Will fail if not using --allow-env
  }

  return {
    apiKey: getGlobalApiKey(),
    databaseURL: getGlobalDatabaseURL(),
    branch: getGlobalBranch(),
    envBranch: undefined
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

export function getDatabaseURL() {
  try {
    const { databaseURL } = getEnvironment();
    return databaseURL;
  } catch (err) {
    return undefined;
  }
}

export function getAPIKey() {
  try {
    const { apiKey } = getEnvironment();
    return apiKey;
  } catch (err) {
    return undefined;
  }
}

export function getBranch() {
  try {
    const { branch, envBranch } = getEnvironment();
    return branch ?? envBranch;
  } catch (err) {
    return undefined;
  }
}
