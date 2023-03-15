declare namespace process {
  const env: Record<string, string>;
}

declare function require(module: string): any;

interface ImportMeta {
  env: Record<string, string>;
}
