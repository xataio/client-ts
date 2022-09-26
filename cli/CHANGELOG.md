# @xata.io/cli

## 0.9.4

### Patch Changes

- [#610](https://github.com/xataio/client-ts/pull/610) [`69a05a7`](https://github.com/xataio/client-ts/commit/69a05a7bf2604fd197bc866a5644afa2f6aa4fcc) Thanks [@gimenete](https://github.com/gimenete)! - Add support for not null and unique in interactive schema editor

- [#653](https://github.com/xataio/client-ts/pull/653) [`7613417`](https://github.com/xataio/client-ts/commit/7613417fba2c09ebdd5e743f778a5ea642baffa2) Thanks [@SferaDev](https://github.com/SferaDev)! - Allow passing skip rows option to importer

- Updated dependencies [[`7613417`](https://github.com/xataio/client-ts/commit/7613417fba2c09ebdd5e743f778a5ea642baffa2), [`b8d441f`](https://github.com/xataio/client-ts/commit/b8d441f80867322f41989d52c94bba230632782b)]:
  - @xata.io/importer@0.2.9
  - @xata.io/client@0.18.4

## 0.9.3

### Patch Changes

- [#602](https://github.com/xataio/client-ts/pull/602) [`74b17aa`](https://github.com/xataio/client-ts/commit/74b17aaedc0dbdd79bfdcb182b2e70b61f98f5a5) Thanks [@gimenete](https://github.com/gimenete)! - API: Make workspace slug optional on create

- [#583](https://github.com/xataio/client-ts/pull/583) [`eb7ba59`](https://github.com/xataio/client-ts/commit/eb7ba594be2a1f0ab90956836bbeb912e188a46d) Thanks [@SferaDev](https://github.com/SferaDev)! - Add support for non nullable columns

- [#611](https://github.com/xataio/client-ts/pull/611) [`349bfa5`](https://github.com/xataio/client-ts/commit/349bfa503776021a0634c5d11567281a3728df0d) Thanks [@gimenete](https://github.com/gimenete)! - Use .env.local if it exists for storing env vars during xata init. Load .env.local and .env always in the CLI.

- Updated dependencies [[`330b076`](https://github.com/xataio/client-ts/commit/330b076a0781e3576c82afab76e3fb2a64f2e041), [`c3dfb4b`](https://github.com/xataio/client-ts/commit/c3dfb4babc990634b9e9747616ed93223178a2e7), [`699beb4`](https://github.com/xataio/client-ts/commit/699beb4bbf21cffa001d3f88a03246980e30250b), [`74b17aa`](https://github.com/xataio/client-ts/commit/74b17aaedc0dbdd79bfdcb182b2e70b61f98f5a5), [`83f20cd`](https://github.com/xataio/client-ts/commit/83f20cdbe53706c16016c4db3f318e679b24ec86), [`addfcc6`](https://github.com/xataio/client-ts/commit/addfcc67fca663defdd340111ea09c9188bad3ab), [`eb7ba59`](https://github.com/xataio/client-ts/commit/eb7ba594be2a1f0ab90956836bbeb912e188a46d), [`f1a0742`](https://github.com/xataio/client-ts/commit/f1a0742a04e1aefab14f46371a04a41069faec01)]:
  - @xata.io/client@0.18.0
  - @xata.io/codegen@0.18.0
  - @xata.io/importer@0.2.8

## 0.9.2

### Patch Changes

- [#588](https://github.com/xataio/client-ts/pull/588) [`26d9c1d`](https://github.com/xataio/client-ts/commit/26d9c1dd2c78c99febc6f3f0e4db5690f36311c6) Thanks [@gimenete](https://github.com/gimenete)! - Fixed CLI on Windows

* [#569](https://github.com/xataio/client-ts/pull/569) [`87bf2c0`](https://github.com/xataio/client-ts/commit/87bf2c0e605fd05f12c2f70abaa8bded08aecd0e) Thanks [@SferaDev](https://github.com/SferaDev)! - Importer: Add max rows, delimiter and null value options

- [#569](https://github.com/xataio/client-ts/pull/569) [`b14f85f`](https://github.com/xataio/client-ts/commit/b14f85f507730819e23d52792cb0ed072a1d2a3c) Thanks [@SferaDev](https://github.com/SferaDev)! - Importer: Allow passing custom batch size and increase default to 1000

* [#569](https://github.com/xataio/client-ts/pull/569) [`b14f85f`](https://github.com/xataio/client-ts/commit/b14f85f507730819e23d52792cb0ed072a1d2a3c) Thanks [@SferaDev](https://github.com/SferaDev)! - Importer: Add support for id, link and datetime columns

* Updated dependencies [[`a305072`](https://github.com/xataio/client-ts/commit/a3050726517632b4975f2a2ed5f771dd247e51d5), [`30e9271`](https://github.com/xataio/client-ts/commit/30e92716b676a2901a4a63d2fd07d047879e3e23), [`7812a41`](https://github.com/xataio/client-ts/commit/7812a414b7d99e9515c0ce48a61ad7a8b84d65d0), [`d4a8ced`](https://github.com/xataio/client-ts/commit/d4a8ced9c257058ed7f660e01ee5fd1da154c391), [`cf85b13`](https://github.com/xataio/client-ts/commit/cf85b13e1ca69e79100fd02f58d79d556012395d), [`2350739`](https://github.com/xataio/client-ts/commit/2350739d3f0a176b0f1fc77b0f4f597321349726), [`a336e61`](https://github.com/xataio/client-ts/commit/a336e6161be04a652e6f0f0a4c2edac10d50c99e), [`b14f85f`](https://github.com/xataio/client-ts/commit/b14f85f507730819e23d52792cb0ed072a1d2a3c), [`b14f85f`](https://github.com/xataio/client-ts/commit/b14f85f507730819e23d52792cb0ed072a1d2a3c)]:
  - @xata.io/client@0.17.1
  - @xata.io/importer@0.2.7

## 0.9.1

### Patch Changes

- [#570](https://github.com/xataio/client-ts/pull/570) [`e4af349`](https://github.com/xataio/client-ts/commit/e4af349e197a432ae9425aeda7aa5db5faaa8082) Thanks [@SferaDev](https://github.com/SferaDev)! - Update internal types

- Updated dependencies [[`e4af349`](https://github.com/xataio/client-ts/commit/e4af349e197a432ae9425aeda7aa5db5faaa8082), [`26e91d1`](https://github.com/xataio/client-ts/commit/26e91d1d84df082dedd7159271fc7c27ec87fefe), [`3332d43`](https://github.com/xataio/client-ts/commit/3332d43121367f61c8d87dfb7da2af65bd1c278f)]:
  - @xata.io/codegen@0.17.0
  - @xata.io/client@0.17.0
  - @xata.io/importer@0.2.6

## 0.9.0

### Minor Changes

- [#514](https://github.com/xataio/client-ts/pull/514) [`2b3aee5`](https://github.com/xataio/client-ts/commit/2b3aee5e83223401936457374e10e11f339e2a36) Thanks [@gimenete](https://github.com/gimenete)! - Ask to introduce workspace/db/branch name to confirm deletions

* [#511](https://github.com/xataio/client-ts/pull/511) [`0fdfec7`](https://github.com/xataio/client-ts/commit/0fdfec7a463948054a51026f728e0fa4a5112d98) Thanks [@gimenete](https://github.com/gimenete)! - Add xata status command

### Patch Changes

- [#525](https://github.com/xataio/client-ts/pull/525) [`5f0f2c2`](https://github.com/xataio/client-ts/commit/5f0f2c2bb42da360e810f0a61ce360f8f8b07a04) Thanks [@xata-bot](https://github.com/xata-bot)! - Update dependencies

- Updated dependencies [[`e33d8fb`](https://github.com/xataio/client-ts/commit/e33d8fbca264d3ab1597ed698d5e79484dcba8a3), [`a3b1044`](https://github.com/xataio/client-ts/commit/a3b1044038c4ae73b4aacaa112818e69b7d380e1), [`5f0f2c2`](https://github.com/xataio/client-ts/commit/5f0f2c2bb42da360e810f0a61ce360f8f8b07a04), [`370a2e0`](https://github.com/xataio/client-ts/commit/370a2e0ae94f2ad714ad5bdefb3e0fb4d99f88c5)]:
  - @xata.io/client@0.16.1
  - @xata.io/codegen@0.16.1

## 0.8.1

### Patch Changes

- [#508](https://github.com/xataio/client-ts/pull/508) [`2187276`](https://github.com/xataio/client-ts/commit/2187276b58fe2c0427a4935d0cb760855dfa0e15) Thanks [@gimenete](https://github.com/gimenete)! - Remove code highlighting in xata init

- Updated dependencies [[`6a96ea5`](https://github.com/xataio/client-ts/commit/6a96ea5da4c5b7ca9a99b57ebbce8d6766b5d4d8), [`43f2560`](https://github.com/xataio/client-ts/commit/43f25605ddd0d2fd514a1542a14389d28955c500), [`a9cbb26`](https://github.com/xataio/client-ts/commit/a9cbb263fbca47cb91a827db252d95a5bb4079a6), [`7e04a3d`](https://github.com/xataio/client-ts/commit/7e04a3d1c51958a44f687a0036ead8bb3f5a2dfb)]:
  - @xata.io/client@0.16.0
  - @xata.io/importer@0.2.5

## 0.8.0

### Minor Changes

- [#501](https://github.com/xataio/client-ts/pull/501) [`ad9817f`](https://github.com/xataio/client-ts/commit/ad9817fc4191158c7beaeb292bb8cd4f55a5ec6d) Thanks [@SferaDev](https://github.com/SferaDev)! - Do not pluralize table names

### Patch Changes

- [#502](https://github.com/xataio/client-ts/pull/502) [`7e4837d`](https://github.com/xataio/client-ts/commit/7e4837d3820157d47d222fb05c18417178dcda22) Thanks [@gimenete](https://github.com/gimenete)! - Provide feedback when the API key is invalid

## 0.7.0

### Minor Changes

- [#457](https://github.com/xataio/client-ts/pull/457) [`0584a5b`](https://github.com/xataio/client-ts/commit/0584a5b207a21dbc36ddc1d44b276f1d5bb60dc5) Thanks [@SferaDev](https://github.com/SferaDev)! - Load env variables so that code analysis detects them

* [#455](https://github.com/xataio/client-ts/pull/455) [`cfa7cab`](https://github.com/xataio/client-ts/commit/cfa7cab134ca9bbcc0a3a841fd37c86bb630dce6) Thanks [@gimenete](https://github.com/gimenete)! - Allow editing the schema from source with xata schema edit --source

- [#475](https://github.com/xataio/client-ts/pull/475) [`b6fa1b1`](https://github.com/xataio/client-ts/commit/b6fa1b11c27163c25bb9973697daae658b1a12e9) Thanks [@gimenete](https://github.com/gimenete)! - Allow injecting the branch name in codegen

## 0.6.0

### Minor Changes

- [#437](https://github.com/xataio/client-ts/pull/437) [`c5312f4`](https://github.com/xataio/client-ts/commit/c5312f4b89e9d3b6597ba2649b96d337019b8442) Thanks [@fabien0102](https://github.com/fabien0102)! - Re-order config values priority

### Patch Changes

- [#435](https://github.com/xataio/client-ts/pull/435) [`12c1f1a`](https://github.com/xataio/client-ts/commit/12c1f1a0dbb70a9355560e1690fcce2e535ff808) Thanks [@gimenete](https://github.com/gimenete)! - Fix error creating link columns with xata schema edit

## 0.5.0

### Minor Changes

- [#382](https://github.com/xataio/client-ts/pull/382) [`5620f59`](https://github.com/xataio/client-ts/commit/5620f5938dabb29ccb83eac9894b6f6478656fc1) Thanks [@gimenete](https://github.com/gimenete)! - Support for --no-input flag. Better support for --force flag and added more flags to some commands

### Patch Changes

- [#388](https://github.com/xataio/client-ts/pull/388) [`551f6cb`](https://github.com/xataio/client-ts/commit/551f6cb1441adde099e0f78a6fb163fc0b35132a) Thanks [@gimenete](https://github.com/gimenete)! - Improves xata init experience

## 0.4.2

### Patch Changes

- Updated dependencies [[`c9f34ad`](https://github.com/xataio/client-ts/commit/c9f34ad37d75203083a1dec2fac2b03e096521af), [`5f82e43`](https://github.com/xataio/client-ts/commit/5f82e4394010f40dcbf3faf2d0bdb58a6fc1c37a)]:
  - @xata.io/client@0.13.0
  - @xata.io/importer@0.2.2

## 0.4.1

### Patch Changes

- [#383](https://github.com/xataio/client-ts/pull/383) [`0756bfe`](https://github.com/xataio/client-ts/commit/0756bfe2f60ad76ba9df55b9b66687c4cf96e9bb) Thanks [@gimenete](https://github.com/gimenete)! - Fix executing npm/yarn on Windows

## 0.4.0

### Minor Changes

- [#368](https://github.com/xataio/client-ts/pull/368) [`20be1af`](https://github.com/xataio/client-ts/commit/20be1afa24e8cd8571541ec532bb537524561b2a) Thanks [@gimenete](https://github.com/gimenete)! - Changed --databaseURL flag to --db

### Patch Changes

- [#385](https://github.com/xataio/client-ts/pull/385) [`11745fa`](https://github.com/xataio/client-ts/commit/11745fa05b6b83a2591c09fcf4e29d815e60fae7) Thanks [@gimenete](https://github.com/gimenete)! - Added autocomplete to some prompts

* [#367](https://github.com/xataio/client-ts/pull/367) [`d861608`](https://github.com/xataio/client-ts/commit/d86160803f317a9e72e55121afb42573b574c20e) Thanks [@gimenete](https://github.com/gimenete)! - Some fixes, including adding a missing dependency for codegen

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
