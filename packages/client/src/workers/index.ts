import { Request } from '../util/request';

type XataWorkerContext<XataClient> = { xata: XataClient; request: Request; env: Record<string, string | undefined> };

type RemoveFirst<T> = T extends [any, ...infer U] ? U : never;

type WorkerRunnerConfig = {
  workspace: string;
  worker: string;
};

export function buildWorkerRunner<XataClient>(config: WorkerRunnerConfig) {
  return function xataWorker<WorkerFunction extends (ctx: XataWorkerContext<XataClient>, ...args: any[]) => any>(
    name: string,
    _worker: WorkerFunction
  ) {
    return async (...args: RemoveFirst<Parameters<WorkerFunction>>): Promise<Awaited<ReturnType<typeof _worker>>> => {
      const url =
        process.env.NODE_ENV === 'development' ? 'http://localhost:64749' : 'https://dispatcher.xata.workers.dev';

      // @ts-ignore - This is a browser only feature - fetch will be defined in the browser
      const result = await fetch(`${url}/${config.workspace}/${config.worker}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // TODO: Add serializer
        body: JSON.stringify({ args })
      });

      // TODO: Detect if not compiled yet (+ errors)

      // TODO: Add deserializer
      return result.json() as any;
    };
  };
}
