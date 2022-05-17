declare namespace Deno {
  const env: {
    get(name: string): string | undefined;
  };

  function run(options: { cmd: string[]; stdout?: string; stderr?: string }): { output(): Promise<BufferSource> };
}
