import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { generateJSONSchema, PgRollMigrationDefinition } from '.';

const server = new McpServer({
  name: 'pgroll',
  version: '1.0.0'
});

server.resource('json-schema', new ResourceTemplate('pgroll://schema', { list: undefined }), async (uri) => ({
  contents: [
    {
      uri: uri.href,
      text: JSON.stringify(generateJSONSchema())
    }
  ]
}));

server.tool('validate-migration', { migration: PgRollMigrationDefinition }, async ({ migration }) => {
  const result = PgRollMigrationDefinition.safeParse(migration);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          valid: result.success,
          errors: result.error
        })
      }
    ]
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
