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
    workspaces: 'https://{workspaceId}.xata.sh'
  },
  staging: {
    main: 'https://staging.xatabase.co',
    workspaces: 'https://{workspaceId}.staging.xatabase.co'
  }
};

export function isHostProviderAlias(alias: HostProvider | string): alias is HostAliases {
  return isString(alias) && Object.keys(providers).includes(alias);
}

export function isHostProviderBuilder(builder: HostProvider): builder is ProviderBuilder {
  return isObject(builder) && isString(builder.main) && isString(builder.workspaces);
}
