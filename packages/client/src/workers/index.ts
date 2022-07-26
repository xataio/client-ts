import { ClientConstructor } from '../client';
import { Request } from '../util/request';

type XataWorkerContext<XataClient> = { xata: XataClient; request: Request; env: Record<string, string | undefined> };

type RemoveFirst<T> = T extends [any, ...infer U] ? U : never;

type WorkerRunnerConfig = {
  worker: string;
  publicKey: string;
};

export function buildWorkerRunner<XataClient extends ClientConstructor>(config: WorkerRunnerConfig) {
  return function xataWorker<WorkerFunction extends (ctx: XataWorkerContext<XataClient>, ...args: any[]) => any>(
    name: string,
    _worker: WorkerFunction
  ) {
    return async (...args: RemoveFirst<Parameters<WorkerFunction>>): Promise<Awaited<ReturnType<typeof _worker>>> => {
      // Get an instance of crypto in browser, no need for cross compat, crypto subtle it is

      // TODO: Call PROD too

      // @ts-ignore - This is a browser only feature - fetch will be defined in the browser
      const result = await fetch('http://localhost:64749', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // TODO: Encrypt this
        // TODO: Add serializer
        body: JSON.stringify({
          name,
          payload: args
        })
      });

      // TODO: Detect if not compiled yet (+ errors)

      // TODO: Add deserializer
      return result.json() as any;
    };
  };
}
