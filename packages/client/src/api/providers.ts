import { isObject, isString } from '../util/lang';

type HostAliases = 'production' | 'staging';
type ProviderBuilder = { main: string; workspaces: string };
export type HostProvider = HostAliases | ProviderBuilder;

export function getHostUrl(provider: HostProvider, type: keyof ProviderBuilder): string {
  if (isValidAlias(provider)) {
    return providers[provider][type];
  } else if (isValidBuilder(provider)) {
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

function isValidAlias(alias: HostProvider): alias is HostAliases {
  return isString(alias) && Object.keys(providers).includes(alias);
}

function isValidBuilder(builder: HostProvider): builder is ProviderBuilder {
  return isObject(builder) && isString(builder.main) && isString(builder.workspaces);
}
