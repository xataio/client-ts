# @xata.io/codegen

## 0.9.0

### Patch Changes

- [#230](https://github.com/xataio/client-ts/pull/230) [`a96da7c`](https://github.com/xataio/client-ts/commit/a96da7c8b548604ed25001390992531537675a44) Thanks [@SferaDev](https://github.com/SferaDev)! - Include tables in Proxy target for object introspection (shell)

- Updated dependencies [[`2fc2788`](https://github.com/xataio/client-ts/commit/2fc2788e583c047ffb2cd693f053f60ce608149c), [`a96da7c`](https://github.com/xataio/client-ts/commit/a96da7c8b548604ed25001390992531537675a44), [`e8d595f`](https://github.com/xataio/client-ts/commit/e8d595f54efe126b39c78cc771a5d69c551f4fba), [`c4dcd11`](https://github.com/xataio/client-ts/commit/c4dcd110d8f9dc3a7e4510f2f00257c9109e51fa), [`2848894`](https://github.com/xataio/client-ts/commit/284889446bbac5d6737086bf01a588d97b841730)]:
  - @xata.io/client@0.9.0

## 0.8.1

### Patch Changes

- 5110261: Fix execution from the browser
- 0047193: Add new plugin system for the SDK

## 0.8.0

### Minor Changes

- 8b56394: Support using environment variables instead of a xata dir

### Patch Changes

- bde908e: Refactor client builder

## 0.7.2

### Patch Changes

- d58c3d9: Hide private helper utilities

## 0.6.0

### Minor Changes

- d11276b: Generate typedefs from dts files

## 0.5.1

### Patch Changes

- 77ba3c2: Allow table name to start with a number

## 0.5.0

### Minor Changes

- bc9567d: Codegen will no longer download the Xata CLI now that the CLI supports hooks

### Patch Changes

- 14ec7d1: Fix in Selectable type

## 0.4.0

### Minor Changes

- d9edb42: Removed the `generate` subcommand. Now the CLI needs to be invoked without it.
- 7fdd319: Better error handling. Codegen will now try to create the parent directory of the output file if it doesn't exist
- d73def1: Allow codegen to be executed from npx

### Patch Changes

- d13185a: Emit TS declaration files in codegen
- b951331: Add support for new float column
- a49b336: Split entity from record
- db3293a: Update imports to ESM format

## 0.3.1

### Patch Changes

- 4e1db9c: Fix binary compilation of codegen

## 0.3.0

### Patch Changes

- 1c0a454: Make schema fields nullable
