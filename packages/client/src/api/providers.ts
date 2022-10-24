import { isObject, isString } from '../util/lang';

type HostAliases = 'production' | 'staging';
type ProviderBuilder = { main: string; workspaces: string };
export type HostProvider = HostAliases | ProviderBuilder;

export function getHostUrl(provider: HostProvider, type: keyof ProviderBuilder): string {
  if (isHostProviderAlias(provider)) {
    return providers[provider][type];
  } else if (isHostProviderBuilder(provider)) {
    return provider[type];
  }

  throw new Error('Invalid API provider');
}

const providers: Record<HostAliases, ProviderBuilder> = {
  production: {
    main: 'https://api.xata.io',
    workspaces: 'https://{workspaceId}.{region}.xata.sh'
  },
  staging: {
    main: 'https://staging.xatabase.co',
    workspaces: 'https://{workspaceId}.staging.{region}.xatabase.co'
  }
};

export function isHostProviderAlias(alias: HostProvider | string): alias is HostAliases {
  return isString(alias) && Object.keys(providers).includes(alias);
}

export function isHostProviderBuilder(builder: HostProvider): builder is ProviderBuilder {
  return isObject(builder) && isString(builder.main) && isString(builder.workspaces);
}

export function parseProviderString(provider = 'production'): HostProvider | null {
  if (isHostProviderAlias(provider)) {
    return provider;
  }

  const [main, workspaces] = provider.split(',');
  if (!main || !workspaces) return null;
  return { main, workspaces };
}

export function parseWorkspacesUrlParts(url: string): { workspace: string; region: string } | null {
  if (!isString(url)) return null;

  const regex = /(?:https:\/\/)?([^.]+)(?:\.([^.]+))?\.xata\.sh.*/;
  const regexStaging = /(?:https:\/\/)?([^.]+)\.staging(?:\.([^.]+))?\.xatabase\.co.*/;

  const match = url.match(regex) || url.match(regexStaging);
  if (!match) return null;

  // Region is optional for now, so we default to 'EU'
  return { workspace: match[1], region: match[2] ?? 'eu-west-1' };
}
