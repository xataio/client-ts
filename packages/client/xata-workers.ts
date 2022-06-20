// @ts-ignore
import { XataApiClient, BaseClient } from '@xata.io/client';

export default {
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    return new Response(JSON.stringify({ request, env }));
  }
};
