import { defineConfig } from '@openapi-codegen/cli';
import { Context } from '@openapi-codegen/cli/lib/types';
import { addPathParam, generateFetchers, generateSchemaTypes, renameComponent } from '@openapi-codegen/typescript';

export default defineConfig({
  xatabase: {
    from: {
      source: 'github',
      owner: 'xataio',
      ref: 'main',
      repository: 'openapi',
      specPath: 'bundled/openapi.yaml'
    },
    outputDir: 'packages/client/src/api',
    to: async (context) => {
      // TODO: Fix me, allow no filenamePrefix
      const filenamePrefix = ' ';

      context.openAPIDocument = removeDraftPaths({ openAPIDocument: context.openAPIDocument });

      // Avoid conflict with typescript `Record<>` type helper
      context.openAPIDocument = renameComponent({
        openAPIDocument: context.openAPIDocument,
        from: '#/components/schemas/Record',
        to: '#/components/schemas/XataRecord'
      });

      // Inject path param in all requests
      context.openAPIDocument = addPathParam({
        openAPIDocument: context.openAPIDocument,
        pathParam: 'workspace',
        required: true,
        condition: (path) => path.startsWith('/db') ?? false
      });

      const { schemasFiles } = await generateSchemaTypes(context, { filenamePrefix });
      await generateFetchers(context, { filenamePrefix, schemasFiles });
    }
  }
});

function removeDraftPaths({ openAPIDocument }: { openAPIDocument: Context['openAPIDocument'] }) {
  const paths = Object.fromEntries(
    Object.entries(openAPIDocument.paths).map(([route, verbs]) => {
      const updatedVerbs = Object.entries(verbs).reduce((acc, [verb, operation]) => {
        if (isVerb(verb) && isDraft(operation)) {
          return acc;
        }

        return { ...acc, [verb]: operation };
      }, {});

      return [route, updatedVerbs];
    })
  );

  return { ...openAPIDocument, paths };
}

const isVerb = (verb: string): verb is 'get' | 'post' | 'patch' | 'put' | 'delete' =>
  ['get', 'post', 'patch', 'put', 'delete'].includes(verb);

const isDraft = (operation: unknown) => {
  if (!operation || typeof operation !== 'object') {
    return false;
  }

  return operation['x-draft'] === true;
};
