# @xata.io/codegen

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
