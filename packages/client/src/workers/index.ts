import { deserialize, serialize, SerializerResult } from '../serializer';
import { Request } from '../util/request';

type XataWorkerContext<XataClient> = { xata: XataClient; request: Request; env: Record<string, string | undefined> };

type XataWorkerResult<T extends (...args: any) => any> = SerializerResult<Awaited<ReturnType<T>>>;

type RemoveFirst<T> = T extends [any, ...infer U] ? U : never;

type WorkerRunnerConfig = {
  workspace: string;
  worker: string;
};

export function buildWorkerRunner<XataClient>(config: WorkerRunnerConfig) {
  return function xataWorker<WorkerFunction extends (ctx: XataWorkerContext<XataClient>, ...args: any[]) => any>(
    name: string,
    worker: WorkerFunction
  ) {
    return async (...args: RemoveFirst<Parameters<WorkerFunction>>): Promise<XataWorkerResult<typeof worker>> => {
      const url =
        process.env.NODE_ENV === 'development'
          ? `http://localhost:64749/${name}`
          : `https://dispatcher.xata.workers.dev/${config.workspace}/${config.worker}/${name}`;

      // @ts-ignore - This is a browser only feature - fetch will be defined in the browser
      const result = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serialize({ args })
      });

      // TODO: Detect if not compiled yet (+ other errors)

      const text = await result.text();
      return deserialize<any>(text);
    };
  };
}
