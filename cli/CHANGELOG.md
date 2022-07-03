# @xata.io/cli

## 0.4.0

### Minor Changes

- [#368](https://github.com/xataio/client-ts/pull/368) [`20be1af`](https://github.com/xataio/client-ts/commit/20be1afa24e8cd8571541ec532bb537524561b2a) Thanks [@gimenete](https://github.com/gimenete)! - Changed --databaseURL flag to --db

### Patch Changes

- [#385](https://github.com/xataio/client-ts/pull/385) [`11745fa`](https://github.com/xataio/client-ts/commit/11745fa05b6b83a2591c09fcf4e29d815e60fae7) Thanks [@gimenete](https://github.com/gimenete)! - Added autocomplete to some prompts

* [#367](https://github.com/xataio/client-ts/pull/367) [`d861608`](https://github.com/xataio/client-ts/commit/d86160803f317a9e72e55121afb42573b574c20e) Thanks [@gimenete](https://github.com/gimenete)! - Some fixes, including adding a missing dependency for codegen

* Updated dependencies [[`db3c88e`](https://github.com/xataio/client-ts/commit/db3c88e1f2bee6d308afb8d6e95b7c090a87e7a7), [`1cde95f`](https://github.com/xataio/client-ts/commit/1cde95f05a6b9fbf0564ea05400140f0cef41a3a), [`8bc84f1`](https://github.com/xataio/client-ts/commit/8bc84f17a3ad1cc66aa6c9c9cfe4898e284d37ce), [`57bf0e2`](https://github.com/xataio/client-ts/commit/57bf0e2e049ed0498683ff42d287983f295342b7), [`d861608`](https://github.com/xataio/client-ts/commit/d86160803f317a9e72e55121afb42573b574c20e)]:
  - @xata.io/client@0.12.0
  - @xata.io/codegen@0.12.0
  - @xata.io/importer@0.2.1

## 0.3.0

### Minor Changes

- [#339](https://github.com/xataio/client-ts/pull/339) [`aeafe54`](https://github.com/xataio/client-ts/commit/aeafe54b53e203cf9357b4f4cfd648fa303be38a) Thanks [@gimenete](https://github.com/gimenete)! - Move importer command to CLI

* [#316](https://github.com/xataio/client-ts/pull/316) [`345d31c`](https://github.com/xataio/client-ts/commit/345d31c2bce1581355c665d295505d20c41c95d8) Thanks [@gimenete](https://github.com/gimenete)! - Xata init will ask for an API key and a fallback branch

## 0.2.1

### Patch Changes

- [#309](https://github.com/xataio/client-ts/pull/309) [`0b87c1a`](https://github.com/xataio/client-ts/commit/0b87c1a802ccf3ea04547d3d4c570b66f7af3887) Thanks [@SferaDev](https://github.com/SferaDev)! - Shell: Pretty print objects of all depths

* [#309](https://github.com/xataio/client-ts/pull/309) [`c03fef8`](https://github.com/xataio/client-ts/commit/c03fef8164f12ce6e4a2045864a1b9c19542545b) Thanks [@SferaDev](https://github.com/SferaDev)! - Shell: Fix empty body sent

- [#311](https://github.com/xataio/client-ts/pull/311) [`0d74b5a`](https://github.com/xataio/client-ts/commit/0d74b5a3469e7ea468afea0b3d99fe62de71c252) Thanks [@gimenete](https://github.com/gimenete)! - Some fixes to the xata init and merge commands

* [#309](https://github.com/xataio/client-ts/pull/309) [`b643d61`](https://github.com/xataio/client-ts/commit/b643d61050c0c22887a6adf8d75e6d0867d66023) Thanks [@SferaDev](https://github.com/SferaDev)! - Shell: Add HTTP operations to api.\*

## 0.2.0

### Minor Changes

- [#267](https://github.com/xataio/client-ts/pull/267) [`926ba17`](https://github.com/xataio/client-ts/commit/926ba17ccdcb38d1ab2b25a4dcb3baa2c1862516) Thanks [@gimenete](https://github.com/gimenete)! - Added option to generate an API key on the fly

* [#287](https://github.com/xataio/client-ts/pull/287) [`7a895a9`](https://github.com/xataio/client-ts/commit/7a895a93b2abf705ddd02c4789c20d818d6eee43) Thanks [@gimenete](https://github.com/gimenete)! - Added merge command

- [#286](https://github.com/xataio/client-ts/pull/286) [`68b0469`](https://github.com/xataio/client-ts/commit/68b046911d2e40cd352377034e0dcdfd8dedb065) Thanks [@gimenete](https://github.com/gimenete)! - Added "schema dump" command

* [#301](https://github.com/xataio/client-ts/pull/301) [`a44f091`](https://github.com/xataio/client-ts/commit/a44f091b729f36b3fcfaba63fc70b02f6798ff84) Thanks [@gimenete](https://github.com/gimenete)! - Changed the way API keys are stored

### Patch Changes

- [#291](https://github.com/xataio/client-ts/pull/291) [`e360b6d`](https://github.com/xataio/client-ts/commit/e360b6d4b52ff6be96d4a8ddde9620f77c547b62) Thanks [@SferaDev](https://github.com/SferaDev)! - Fix some commands to read apiKey from file

* [#292](https://github.com/xataio/client-ts/pull/292) [`8a82f24`](https://github.com/xataio/client-ts/commit/8a82f24a654bf462b7c59059e99f2c36183dd6cc) Thanks [@gimenete](https://github.com/gimenete)! - Fix authentication problem with the shell command

- [#297](https://github.com/xataio/client-ts/pull/297) [`e382858`](https://github.com/xataio/client-ts/commit/e38285893afb7c1b2636b12850399c34fe6cd3ee) Thanks [@gimenete](https://github.com/gimenete)! - Fixes an error when JS is used for the code generator. Also improves the CLI interactivity.

* [#271](https://github.com/xataio/client-ts/pull/271) [`0bb17b8`](https://github.com/xataio/client-ts/commit/0bb17b88d49f1c8be32d2d6b0b3a5918890876cb) Thanks [@SferaDev](https://github.com/SferaDev)! - Link and resolve branches from git

## 0.1.3

### Patch Changes

- [#289](https://github.com/xataio/client-ts/pull/289) [`9a41035`](https://github.com/xataio/client-ts/commit/9a410354911d89116b332dd3ed7345b1156f74ef) Thanks [@gimenete](https://github.com/gimenete)! - Fix execution of the cli from npx

## 0.1.2

### Patch Changes

- Updated dependencies [[`6d76275`](https://github.com/xataio/client-ts/commit/6d7627555a404a4c2da42f4187df6f8300f9a46f), [`d1ec0df`](https://github.com/xataio/client-ts/commit/d1ec0df14834088a816919bfc68216f3f9b2d9ef), [`1864742`](https://github.com/xataio/client-ts/commit/18647428d8608841de514c3784fb711c39dccc6d), [`1af6f1a`](https://github.com/xataio/client-ts/commit/1af6f1aaa1123e77a895961581c87f06a88db698), [`be4eda8`](https://github.com/xataio/client-ts/commit/be4eda8f73037d97fef7de28b56d7471dd867875), [`99be734`](https://github.com/xataio/client-ts/commit/99be734827576d888aa12a579ed1983a0a8a8e83)]:
  - @xata.io/client@0.10.0
  - @xata.io/codegen@0.10.0
  - @xata.io/shell@0.1.4

## 0.1.1

### Patch Changes

- [#273](https://github.com/xataio/client-ts/pull/273) [`30bfc10`](https://github.com/xataio/client-ts/commit/30bfc10f07ec0743cdaf15f1173e0487686a9d58) Thanks [@SferaDev](https://github.com/SferaDev)! - Add datetime columns

## 0.1.0

### Minor Changes

- [#263](https://github.com/xataio/client-ts/pull/263) [`8ac045c`](https://github.com/xataio/client-ts/commit/8ac045c900f546f6abc2d4a73c38e07047b53583) Thanks [@gimenete](https://github.com/gimenete)! - Added command random-data

### Patch Changes

- [#258](https://github.com/xataio/client-ts/pull/258) [`8bd00a3`](https://github.com/xataio/client-ts/commit/8bd00a3efb2328d6700ee89ecdebc3356bc55d7f) Thanks [@gimenete](https://github.com/gimenete)! - Fixes a bug that make the CLI always generate TypeScript code

* [#259](https://github.com/xataio/client-ts/pull/259) [`a2727a3`](https://github.com/xataio/client-ts/commit/a2727a3bf6dfddb41251ff86c40afe7851a9c068) Thanks [@gimenete](https://github.com/gimenete)! - Added command "schema edit"

## 0.0.1

### Patch Changes

- [#247](https://github.com/xataio/client-ts/pull/247) [`53b4ad6`](https://github.com/xataio/client-ts/commit/53b4ad670c9f35387e4d0e26aec5ce0dfd340d07) Thanks [@SferaDev](https://github.com/SferaDev)! - Initial release

- Updated dependencies [[`d2febef`](https://github.com/xataio/client-ts/commit/d2febef5176b1123f38f1619effcd917215ed17c), [`2fc2788`](https://github.com/xataio/client-ts/commit/2fc2788e583c047ffb2cd693f053f60ce608149c), [`a96da7c`](https://github.com/xataio/client-ts/commit/a96da7c8b548604ed25001390992531537675a44), [`e8d595f`](https://github.com/xataio/client-ts/commit/e8d595f54efe126b39c78cc771a5d69c551f4fba), [`c4dcd11`](https://github.com/xataio/client-ts/commit/c4dcd110d8f9dc3a7e4510f2f00257c9109e51fa), [`2848894`](https://github.com/xataio/client-ts/commit/284889446bbac5d6737086bf01a588d97b841730)]:
  - @xata.io/shell@0.1.3
  - @xata.io/client@0.9.0
  - @xata.io/codegen@0.9.0
