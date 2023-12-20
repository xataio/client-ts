import { isObject, isString } from '../util/lang';

type HostAliases = 'production' | 'staging' | 'dev';
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
    main: 'https://api.staging-xata.dev',
    workspaces: 'https://{workspaceId}.{region}.staging-xata.dev'
  },
  dev: {
    main: 'https://api.dev-xata.dev',
    workspaces: 'https://{workspaceId}.{region}.dev-xata.dev'
  }
};

export function isHostProviderAlias(alias?: HostProvider | string): alias is HostAliases {
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

export function buildProviderString(provider: HostProvider): string {
  if (isHostProviderAlias(provider)) return provider;
  return `${provider.main},${provider.workspaces}`;
}

export function parseWorkspacesUrlParts(url: string): { workspace: string; region: string; host: HostAliases } | null {
  if (!isString(url)) return null;

  const matches = {
    production: url.match(/(?:https:\/\/)?([^.]+)(?:\.([^.]+))\.xata\.sh.*/),
    staging: url.match(/(?:https:\/\/)?([^.]+)(?:\.([^.]+))\.staging-xata\.dev.*/),
    dev: url.match(/(?:https:\/\/)?([^.]+)(?:\.([^.]+))\.dev-xata\.dev.*/)
  };

  const [host, match] = Object.entries(matches).find(([, match]) => match !== null) ?? [];
  if (!isHostProviderAlias(host) || !match) return null;

  return { workspace: match[1], region: match[2], host };
}
