import { defineConfig } from '@openapi-codegen/cli';
import { addPathParam, generateFetchers, generateSchemaTypes, renameComponent } from '@openapi-codegen/typescript';

export default defineConfig({
  xatabase: {
    from: {
      source: 'file',
      relativePath: '../openapi/bundled/openapi.yaml'
    },
    outputDir: 'client/src/api',
    to: async (context) => {
      // TODO: Fix me, allow no filenamePrefix
      const filenamePrefix = ' ';

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
