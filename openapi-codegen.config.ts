import { defineConfig } from '@openapi-codegen/cli';
import { generateFetchers, generateSchemaTypes, renameComponent } from '@openapi-codegen/typescript';

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

const addPathParam = ({
  openAPIDocument,
  pathParam,
  required,
  condition: filter = () => true
}: {
  /**
   * The openAPI document to transform
   */
  openAPIDocument: any;
  /**
   * Path param to inject in all requests
   */
  pathParam: string;
  /**
   * If the path param is required
   */
  required: boolean;
  /**
   * Condition to include/exclude the path param
   */
  condition?: (key: string, pathParam: any) => boolean;
}): any => {
  return {
    ...openAPIDocument,
    paths: Object.fromEntries(
      Object.entries(openAPIDocument.paths ?? {}).map(([key, value = {}]: any) =>
        filter(key, value)
          ? [
              key,
              {
                ...value,
                parameters: [
                  ...(value.parameters ?? []),
                  {
                    name: pathParam,
                    in: 'path',
                    required,
                    schema: { type: 'string' }
                  }
                ]
              }
            ]
          : [key, value]
      )
    )
  };
};
