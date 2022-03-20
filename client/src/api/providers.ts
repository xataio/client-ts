import { errors } from '../util/errors';

type AliasedProviders = 'production' | 'staging';
type ProviderBuilder = { main: string; workspaces: string };
export type ApiProviders = AliasedProviders | ProviderBuilder;

export function getApiUrl(provider: ApiProviders, type: keyof ProviderBuilder): string {
  if (isValidAlias(provider)) {
    return providers[provider][type];
  } else if (isValidBuilder(provider)) {
    return provider[type];
  }

  throw new Error(errors.invalidApiProvider);
}

const providers: Record<AliasedProviders, ProviderBuilder> = {
  production: {
    main: 'https://api.xata.io',
    workspaces: 'https://{workspaceId}.xata.sh'
  },
  staging: {
    main: 'https://staging.xatabase.co',
    workspaces: 'https://{workspaceId}.staging.xatabase.co'
  }
};

function isValidAlias(alias: ApiProviders): alias is AliasedProviders {
  return typeof alias === 'string' && Object.keys(providers).includes(alias);
}

function isValidBuilder(builder: ApiProviders): builder is ProviderBuilder {
  return typeof builder === 'object' && typeof builder.main === 'string' && typeof builder.workspaces === 'string';
}
