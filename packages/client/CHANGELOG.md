# @xata.io/client

## 0.16.0

### Minor Changes

- [#485](https://github.com/xataio/client-ts/pull/485) [`a9cbb26`](https://github.com/xataio/client-ts/commit/a9cbb263fbca47cb91a827db252d95a5bb4079a6) Thanks [@SferaDev](https://github.com/SferaDev)! - Allow selecting columns with record operations

* [#485](https://github.com/xataio/client-ts/pull/485) [`7e04a3d`](https://github.com/xataio/client-ts/commit/7e04a3d1c51958a44f687a0036ead8bb3f5a2dfb) Thanks [@SferaDev](https://github.com/SferaDev)! - Remove record cache

### Patch Changes

- [#503](https://github.com/xataio/client-ts/pull/503) [`6a96ea5`](https://github.com/xataio/client-ts/commit/6a96ea5da4c5b7ca9a99b57ebbce8d6766b5d4d8) Thanks [@xata-bot](https://github.com/xata-bot)! - Update API response types for create of tables and branches

* [#421](https://github.com/xataio/client-ts/pull/421) [`43f2560`](https://github.com/xataio/client-ts/commit/43f25605ddd0d2fd514a1542a14389d28955c500) Thanks [@SferaDev](https://github.com/SferaDev)! - Add search boosters and allow prefix search

## 0.15.0

### Patch Changes

- [#496](https://github.com/xataio/client-ts/pull/496) [`e923d11`](https://github.com/xataio/client-ts/commit/e923d11fe357519dc4ca3ae722670e6e70ccd1c6) Thanks [@gimenete](https://github.com/gimenete)! - Ignore git output in Xata client

* [#481](https://github.com/xataio/client-ts/pull/481) [`599b52c`](https://github.com/xataio/client-ts/commit/599b52c3090222eedef85d1ad1e907874cd3e801) Thanks [@xata-bot](https://github.com/xata-bot)! - Add updateWorkspaceMemberInvite API method

## 0.14.0

### Minor Changes

- [#409](https://github.com/xataio/client-ts/pull/409) [`8812380`](https://github.com/xataio/client-ts/commit/881238062b5eeac2dc8b9ba156720e0acc22c5c5) Thanks [@SferaDev](https://github.com/SferaDev)! - Infer types from schema in codegen

* [#457](https://github.com/xataio/client-ts/pull/457) [`0584a5b`](https://github.com/xataio/client-ts/commit/0584a5b207a21dbc36ddc1d44b276f1d5bb60dc5) Thanks [@SferaDev](https://github.com/SferaDev)! - Load env variables so that code analysis detects them

- [#469](https://github.com/xataio/client-ts/pull/469) [`8d8a912`](https://github.com/xataio/client-ts/commit/8d8a9129e36452266c4c12fe35b421f66e572498) Thanks [@gimenete](https://github.com/gimenete)! - Treat branch name specified with third party env variables as git branches in the resolution algorithm

### Patch Changes

- [#462](https://github.com/xataio/client-ts/pull/462) [`7547b7e`](https://github.com/xataio/client-ts/commit/7547b7edbc9a95c6620784cc5348316f27502c73) Thanks [@SferaDev](https://github.com/SferaDev)! - Fix bug with RecordArray.map

* [#472](https://github.com/xataio/client-ts/pull/472) [`e99010c`](https://github.com/xataio/client-ts/commit/e99010c9ab9d355abadcfbcf98b5a3fcc80c307a) Thanks [@SferaDev](https://github.com/SferaDev)! - Add id as entity property

- [#443](https://github.com/xataio/client-ts/pull/443) [`c4be404`](https://github.com/xataio/client-ts/commit/c4be404a3ecb34df9b1ef4501c92f5bdc221f19c) Thanks [@SferaDev](https://github.com/SferaDev)! - Improve performance with `create([])` operation

## 0.13.4

### Patch Changes

- [#444](https://github.com/xataio/client-ts/pull/444) [`3c3a5af`](https://github.com/xataio/client-ts/commit/3c3a5afb1d5fb3295fd8cf6c2b66709a5c047507) Thanks [@SferaDev](https://github.com/SferaDev)! - Publish xata client on deno.land

## 0.13.3

### Patch Changes

- [#434](https://github.com/xataio/client-ts/pull/434) [`b82383d`](https://github.com/xataio/client-ts/commit/b82383d7541d19ae71ad7e047fd100901981f28b) Thanks [@SferaDev](https://github.com/SferaDev)! - Fix problem with SSR `RecordArray` in Next.js

## 0.13.2

### Patch Changes

- [#431](https://github.com/xataio/client-ts/pull/431) [`8f62024`](https://github.com/xataio/client-ts/commit/8f62024101028b981dc31a68fb258e89110d45dc) Thanks [@SferaDev](https://github.com/SferaDev)! - Include request ids in the error response

* [#429](https://github.com/xataio/client-ts/pull/429) [`bb102b4`](https://github.com/xataio/client-ts/commit/bb102b46b722d0a61996c42cda991c9f0080e464) Thanks [@SferaDev](https://github.com/SferaDev)! - Avoid detection of `Buffer` in edge runtime middleware

- [#428](https://github.com/xataio/client-ts/pull/428) [`06740ca`](https://github.com/xataio/client-ts/commit/06740cad216831216f0be8cf9de7e354c0ef9191) Thanks [@SferaDev](https://github.com/SferaDev)! - Improve selection types to make them more readable

## 0.13.1

### Patch Changes

- [#417](https://github.com/xataio/client-ts/pull/417) [`86a14ec`](https://github.com/xataio/client-ts/commit/86a14eccbca94f572252327c9c0306577a1c3ebd) Thanks [@SferaDev](https://github.com/SferaDev)! - Update User-Agent

* [#422](https://github.com/xataio/client-ts/pull/422) [`2896418`](https://github.com/xataio/client-ts/commit/289641844e5b2752197dbbbf3a93ef6068b684e4) Thanks [@SferaDev](https://github.com/SferaDev)! - Allow sending link as string id

- [#420](https://github.com/xataio/client-ts/pull/420) [`301b21f`](https://github.com/xataio/client-ts/commit/301b21f4784f755a8694ca21a0f2fd48e1b16df4) Thanks [@SferaDev](https://github.com/SferaDev)! - Exclude date internal columns in selection

* [#399](https://github.com/xataio/client-ts/pull/399) [`dd4b2ef`](https://github.com/xataio/client-ts/commit/dd4b2effed2251ac8afbfb2909c21a9deb35bef1) Thanks [@SferaDev](https://github.com/SferaDev)! - Allow create many objects mixed some with ids others without

- [#425](https://github.com/xataio/client-ts/pull/425) [`00279ff`](https://github.com/xataio/client-ts/commit/00279ff985793020237f8098cba97dfec7738f82) Thanks [@SferaDev](https://github.com/SferaDev)! - Do not send falsy values to query string

* [#399](https://github.com/xataio/client-ts/pull/399) [`8e66998`](https://github.com/xataio/client-ts/commit/8e6699867a1aa1968d12db4ced80c13d4b951f88) Thanks [@SferaDev](https://github.com/SferaDev)! - Allow passing identifiable objects to `read()` operations

- [#425](https://github.com/xataio/client-ts/pull/425) [`8a4e019`](https://github.com/xataio/client-ts/commit/8a4e019031e678d946cf9dfb0e4803906fad9b5f) Thanks [@SferaDev](https://github.com/SferaDev)! - Add fallback branch to `api.databases.resolveBranch`

## 0.13.0

### Minor Changes

- [#375](https://github.com/xataio/client-ts/pull/375) [`c9f34ad`](https://github.com/xataio/client-ts/commit/c9f34ad37d75203083a1dec2fac2b03e096521af) Thanks [@SferaDev](https://github.com/SferaDev)! - Change default pagination size to 20

* [#375](https://github.com/xataio/client-ts/pull/375) [`5f82e43`](https://github.com/xataio/client-ts/commit/5f82e4394010f40dcbf3faf2d0bdb58a6fc1c37a) Thanks [@SferaDev](https://github.com/SferaDev)! - Return a paginable object in getPaginated

## 0.12.0

### Minor Changes

- [#376](https://github.com/xataio/client-ts/pull/376) [`db3c88e`](https://github.com/xataio/client-ts/commit/db3c88e1f2bee6d308afb8d6e95b7c090a87e7a7) Thanks [@SferaDev](https://github.com/SferaDev)! - Hide xata object and expose getMetadata method

### Patch Changes

- [#364](https://github.com/xataio/client-ts/pull/364) [`1cde95f`](https://github.com/xataio/client-ts/commit/1cde95f05a6b9fbf0564ea05400140f0cef41a3a) Thanks [@SferaDev](https://github.com/SferaDev)! - Add peer dep of TS 4.5+

* [#362](https://github.com/xataio/client-ts/pull/362) [`57bf0e2`](https://github.com/xataio/client-ts/commit/57bf0e2e049ed0498683ff42d287983f295342b7) Thanks [@SferaDev](https://github.com/SferaDev)! - Do not show error if date is not defined

## 0.11.0

### Minor Changes

- [#322](https://github.com/xataio/client-ts/pull/322) [`bc64c28`](https://github.com/xataio/client-ts/commit/bc64c28fbfbb000c7190ac8092e2ef6a261df86f) Thanks [@SferaDev](https://github.com/SferaDev)! - Add filter support for cross-table search operations

### Patch Changes

- [#327](https://github.com/xataio/client-ts/pull/327) [`505257c`](https://github.com/xataio/client-ts/commit/505257c0c42ca0c8beaf5c0f638037c576dcc43c) Thanks [@SferaDev](https://github.com/SferaDev)! - Allow reading multiple uids at the same time

* [#346](https://github.com/xataio/client-ts/pull/346) [`ff7e5c6`](https://github.com/xataio/client-ts/commit/ff7e5c6f211913196d8c28600d7a7675ed261688) Thanks [@SferaDev](https://github.com/SferaDev)! - Fix compat with TS 4.8

- [#345](https://github.com/xataio/client-ts/pull/345) [`bf64cb8`](https://github.com/xataio/client-ts/commit/bf64cb885d55a0271e966314384324f02ded084e) Thanks [@SferaDev](https://github.com/SferaDev)! - Fix bug with nullable record filters inferred as never

* [#334](https://github.com/xataio/client-ts/pull/334) [`ce07601`](https://github.com/xataio/client-ts/commit/ce07601e4ddf9f75e20249d479dc04a63795ca96) Thanks [@SferaDev](https://github.com/SferaDev)! - Add support for TS 4.5

- [#325](https://github.com/xataio/client-ts/pull/325) [`12f1ce3`](https://github.com/xataio/client-ts/commit/12f1ce362f6cda27dfdb3afab0800282bddc8b5e) Thanks [@SferaDev](https://github.com/SferaDev)! - Fix offset errors with operations that affect many rows

* [#345](https://github.com/xataio/client-ts/pull/345) [`a73a2a2`](https://github.com/xataio/client-ts/commit/a73a2a2014c44cf88eaef42196ba1dba9d516b4a) Thanks [@SferaDev](https://github.com/SferaDev)! - Fix issue with Filter<T> not narrowing down type on object properties

## 0.10.2

### Patch Changes

- [#312](https://github.com/xataio/client-ts/pull/312) [`0edf1af`](https://github.com/xataio/client-ts/commit/0edf1af2205c4761d53a02c74ddaab3168d69775) Thanks [@SferaDev](https://github.com/SferaDev)! - Add filtering to search by table

* [#312](https://github.com/xataio/client-ts/pull/312) [`66ad7cc`](https://github.com/xataio/client-ts/commit/66ad7cc0365046c5d039c37117feac04428d8373) Thanks [@SferaDev](https://github.com/SferaDev)! - Add new API method for searching in a given table

## 0.10.1

### Patch Changes

- [#271](https://github.com/xataio/client-ts/pull/271) [`0bb17b8`](https://github.com/xataio/client-ts/commit/0bb17b88d49f1c8be32d2d6b0b3a5918890876cb) Thanks [@SferaDev](https://github.com/SferaDev)! - Link and resolve branches from git

## 0.10.0

### Minor Changes

- [#272](https://github.com/xataio/client-ts/pull/272) [`6d76275`](https://github.com/xataio/client-ts/commit/6d7627555a404a4c2da42f4187df6f8300f9a46f) Thanks [@SferaDev](https://github.com/SferaDev)! - Rename page options to pagination

* [#270](https://github.com/xataio/client-ts/pull/270) [`1864742`](https://github.com/xataio/client-ts/commit/18647428d8608841de514c3784fb711c39dccc6d) Thanks [@SferaDev](https://github.com/SferaDev)! - Move chunk to options object

### Patch Changes

- [#281](https://github.com/xataio/client-ts/pull/281) [`d1ec0df`](https://github.com/xataio/client-ts/commit/d1ec0df14834088a816919bfc68216f3f9b2d9ef) Thanks [@SferaDev](https://github.com/SferaDev)! - Do not send from param on undefined

* [#282](https://github.com/xataio/client-ts/pull/282) [`1af6f1a`](https://github.com/xataio/client-ts/commit/1af6f1aaa1123e77a895961581c87f06a88db698) Thanks [@SferaDev](https://github.com/SferaDev)! - Do not allow filter/sort with cursor navigation

- [#284](https://github.com/xataio/client-ts/pull/284) [`be4eda8`](https://github.com/xataio/client-ts/commit/be4eda8f73037d97fef7de28b56d7471dd867875) Thanks [@SferaDev](https://github.com/SferaDev)! - Fix cache ttl with 0 value

* [#265](https://github.com/xataio/client-ts/pull/265) [`99be734`](https://github.com/xataio/client-ts/commit/99be734827576d888aa12a579ed1983a0a8a8e83) Thanks [@SferaDev](https://github.com/SferaDev)! - Add datetime field type support

## 0.9.1

### Patch Changes

- [#250](https://github.com/xataio/client-ts/pull/250) [`5d7c9e4`](https://github.com/xataio/client-ts/commit/5d7c9e4fa2799255e2bfc8b6fb12c89dc4e1f35e) Thanks [@xata-bot](https://github.com/xata-bot)! - Add branch resolution endpoints to api client

* [#261](https://github.com/xataio/client-ts/pull/261) [`e95f20a`](https://github.com/xataio/client-ts/commit/e95f20a7bce264936680353f816065fa379448fc) Thanks [@gimenete](https://github.com/gimenete)! - Fixes a compatibility error in CloudFlare workers with latest version of wrangler

## 0.9.0

### Minor Changes

- [#246](https://github.com/xataio/client-ts/pull/246) [`2848894`](https://github.com/xataio/client-ts/commit/284889446bbac5d6737086bf01a588d97b841730) Thanks [@SferaDev](https://github.com/SferaDev)! - Rename getOne to getFirst

### Patch Changes

- [#254](https://github.com/xataio/client-ts/pull/254) [`2fc2788`](https://github.com/xataio/client-ts/commit/2fc2788e583c047ffb2cd693f053f60ce608149c) Thanks [@SferaDev](https://github.com/SferaDev)! - Deprecate XataApiClient

* [#230](https://github.com/xataio/client-ts/pull/230) [`a96da7c`](https://github.com/xataio/client-ts/commit/a96da7c8b548604ed25001390992531537675a44) Thanks [@SferaDev](https://github.com/SferaDev)! - Include tables in Proxy target for object introspection (shell)

- [#222](https://github.com/xataio/client-ts/pull/222) [`e8d595f`](https://github.com/xataio/client-ts/commit/e8d595f54efe126b39c78cc771a5d69c551f4fba) Thanks [@SferaDev](https://github.com/SferaDev)! - Add cache strategies

* [#244](https://github.com/xataio/client-ts/pull/244) [`c4dcd11`](https://github.com/xataio/client-ts/commit/c4dcd110d8f9dc3a7e4510f2f00257c9109e51fa) Thanks [@gimenete](https://github.com/gimenete)! - getCurrentBranchName never returns a Promise that resolves to undefined

## 0.8.4

### Patch Changes

- dd958a4: Fix search results return type
- f5ec686: Make XataApiClientOptions optional

## 0.8.3

### Patch Changes

- c660356: Export ESM and CJS bundles

## 0.8.2

### Patch Changes

- 3d81e7a: Make db model references stable

## 0.8.1

### Patch Changes

- 5110261: Fix execution from the browser
- aa3d7e7: Allow sending sort as in the API
- 0047193: Add new plugin system for the SDK
- 43856a5: Add discriminated union search

## 0.8.0

### Patch Changes

- bde908e: Refactor client builder
- ea3eef8: Make records returned by the API readonly

## 0.7.2

### Patch Changes

- 4803b6f: Memoize ApiClient namespaces
- 1f268d7: Add search in XataClient
- d58c3d9: Hide private helper utilities
- f3b731b: Expose branch resolution API

## 0.7.1

### Patch Changes

- 01aef78: Fix bundle for browsers
- 56be1fd: Allow sending updates with link object
- fc51771: Add includes operator helper methods

## 0.7.0

### Minor Changes

- 6ce5512: Add bulk operations for all methods
- 2a1fa4f: Introduced automatic branch resolution mechanism

### Patch Changes

- d033f3a: Improve column selection output type with non-nullable columns
- b1e92db: Include stack trace with errors
- deed570: Improve sorting with multiple properties
- 80b5417: Improve filtering types

## 0.6.0

### Minor Changes

- 084f5df: Add type inference for columns
- bb73c89: Unify create and insert in a single method overload

### Patch Changes

- 716c487: Forward nullable types on links
- bb66bb2: Fix error handling with createMany
- 084f5df: Fix circular dependencies on selectable column

## 0.5.1

### Patch Changes

- 12729ab: Make API client fetch implementation optional

## 0.5.0

### Patch Changes

- 14ec7d1: Fix in Selectable type

## 0.4.0

### Patch Changes

- b951331: Add support for new float column
- d470610: Add new getAll() method
- eaf92a8: Expose pagination constants (size and offset limits)
- 57fde77: Reduce subrequests for createMany
- eaf92a8: Implement schema-less client
- 97a3caa: Make createBranch from optional with empty branch

## 0.3.0

### Minor Changes

- 1c0a454: Add API Client and internally use it

### Patch Changes

- 122321c: Fix client in CF workers and Deno
- a2671b5: Allow cancel or resend workspace invites
- e73d470: Split insert and create
