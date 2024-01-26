# @xata.io/importer

## 1.1.4

### Patch Changes

- [#1330](https://github.com/xataio/client-ts/pull/1330) [`3a8e0a7`](https://github.com/xataio/client-ts/commit/3a8e0a7f96d225f9ecf0ea72945ef618a5b353d6) Thanks [@richardgill](https://github.com/richardgill)! - Importer: Allow coerce floats to int

- Updated dependencies [[`adc961b`](https://github.com/xataio/client-ts/commit/adc961b886b789010e6512c17cb2377eceab665a), [`6031a9d`](https://github.com/xataio/client-ts/commit/6031a9de63c264b7db5b031bb1795258c2bf8150)]:
  - @xata.io/client@0.28.4

## 1.1.3

### Patch Changes

- Updated dependencies [[`e97d1999`](https://github.com/xataio/client-ts/commit/e97d1999f3c25f149213ceca81958e1674624e05)]:
  - @xata.io/client@0.28.0

## 1.1.2

### Patch Changes

- Updated dependencies [[`19c5dd47`](https://github.com/xataio/client-ts/commit/19c5dd47e3a032fcb19d990527b8faaa9326d97d), [`d282d18f`](https://github.com/xataio/client-ts/commit/d282d18f025094e0729ade6009b34fc0d34ebbba)]:
  - @xata.io/client@0.27.0

## 1.1.1

### Patch Changes

- [#1208](https://github.com/xataio/client-ts/pull/1208) [`9865f127`](https://github.com/xataio/client-ts/commit/9865f1276ffc75f7beeee69b62c7bce6af8568c8) Thanks [@SferaDev](https://github.com/SferaDev)! - Add support for importing vectors

- Updated dependencies [[`fa2883b0`](https://github.com/xataio/client-ts/commit/fa2883b0639e48d68097401bf515c8cb95df5b4b), [`c04faece`](https://github.com/xataio/client-ts/commit/c04faece8830699d978e03c89f29e383e479e824), [`cb45cc9f`](https://github.com/xataio/client-ts/commit/cb45cc9f6829e1b555762e656cc1b0b2e977aaf9)]:
  - @xata.io/client@0.26.8

## 1.1.0

### Minor Changes

- [#1190](https://github.com/xataio/client-ts/pull/1190) [`e77644b5`](https://github.com/xataio/client-ts/commit/e77644b560ad02ce6085bc083b07105ae6dddff4) Thanks [@eemmiillyy](https://github.com/eemmiillyy)! - Add support for importing single and multiple files (remote and local) via pathname in CSV column

### Patch Changes

- [#1199](https://github.com/xataio/client-ts/pull/1199) [`652db16b`](https://github.com/xataio/client-ts/commit/652db16b40e507be06ff662e2ffe7a5161f56100) Thanks [@richardgill](https://github.com/richardgill)! - Importer bug fixes

  - Bug fix where CSV chunks of certain sizes caused stackoverflow in some browsers
  - Better error handling if CSV batch parsing fails

- Updated dependencies [[`0e1c50de`](https://github.com/xataio/client-ts/commit/0e1c50de5850db2dfbbdfff9d66eda3bf1322836), [`d093d363`](https://github.com/xataio/client-ts/commit/d093d363a51fc23c8513d51600bb3b31bbc45334)]:
  - @xata.io/client@0.26.7

## 1.0.3

### Patch Changes

- Updated dependencies [[`6ec862f8`](https://github.com/xataio/client-ts/commit/6ec862f8f799eb692f62be79dd0b613b83a34780), [`0c0149ad`](https://github.com/xataio/client-ts/commit/0c0149ad1ee3f7c0fe9d31030552b022c907edb0)]:
  - @xata.io/client@0.26.0

## 1.0.2

### Patch Changes

- [#1108](https://github.com/xataio/client-ts/pull/1108) [`bcb5b989`](https://github.com/xataio/client-ts/commit/bcb5b989478c2288a230d63b1b48dc1fdf7f88e5) Thanks [@richardgill](https://github.com/richardgill)! - Importer: trim whitespace for int, float, datetime and email column types

## 1.0.1

### Patch Changes

- [`6f744f3d`](https://github.com/xataio/client-ts/commit/6f744f3d60fd9d106248cc8a311ab6a09dd3bd3e) Thanks [@richardgill](https://github.com/richardgill)! - importer: Fixed email validation to match the Xata APIs

## 1.0.0

### Major Changes

- [#1051](https://github.com/xataio/client-ts/pull/1051) [`02361aa1`](https://github.com/xataio/client-ts/commit/02361aa197c02267d52157daebf457d526da3e41) Thanks [@richardgill](https://github.com/richardgill)! - Rewrite of: @xata.io/importer with a new design.

  CLI now uses the @xata.io/importer. Improvements:

  - 2.5x performance
  - Better column type inference
  - Better date inference
  - API errors are displayed in the console and written to an `error.log` file

### Patch Changes

- Updated dependencies [[`ac3b968f`](https://github.com/xataio/client-ts/commit/ac3b968f7ca476f2c82b1b2719d020fbd7164f38), [`aef9c834`](https://github.com/xataio/client-ts/commit/aef9c834a850494020e7585cb4ce67b446f9ccfc), [`bcce0d3b`](https://github.com/xataio/client-ts/commit/bcce0d3b0b53468937accd4fee3b5485c35f69ad), [`c1f2d264`](https://github.com/xataio/client-ts/commit/c1f2d2649e077cdffae97c90b9d2b1c75d6858fb), [`6c2c2630`](https://github.com/xataio/client-ts/commit/6c2c26308d4cbd25e7a9677c7d25c836396d4965)]:
  - @xata.io/client@0.25.0

## 0.3.18

### Patch Changes

- Updated dependencies [[`f01d1580`](https://github.com/xataio/client-ts/commit/f01d1580fc450cbf06eb8af85d68cf052fbe83a1), [`52290feb`](https://github.com/xataio/client-ts/commit/52290feb5bba57384cdc14e7722fb5d9883dc581)]:
  - @xata.io/client@0.24.3

## 0.3.17

### Patch Changes

- Updated dependencies [[`51561b52`](https://github.com/xataio/client-ts/commit/51561b52b56ad5ed9101d8faf12929891419cb2c)]:
  - @xata.io/client@0.24.2

## 0.3.16

### Patch Changes

- Updated dependencies [[`eaa774f5`](https://github.com/xataio/client-ts/commit/eaa774f542185ef92448155bcdff331686c4da9f)]:
  - @xata.io/client@0.24.1

## 0.3.15

### Patch Changes

- Updated dependencies [[`45aa2207`](https://github.com/xataio/client-ts/commit/45aa220728e98dd716a55a9a307474732a9b2bc1), [`f28080f0`](https://github.com/xataio/client-ts/commit/f28080f034f02704fe00d64b8f42e1127bde30c7), [`ac9c0604`](https://github.com/xataio/client-ts/commit/ac9c06042bb85105d9a38624676ce6ea5a27d488), [`c163b365`](https://github.com/xataio/client-ts/commit/c163b3658f23fb2eaad6243ebebc92624754099a)]:
  - @xata.io/client@0.24.0

## 0.3.14

### Patch Changes

- [#972](https://github.com/xataio/client-ts/pull/972) [`89375e76`](https://github.com/xataio/client-ts/commit/89375e76b790fed7e6a26bf3ac4ea9eaed1aecae) Thanks [@SferaDev](https://github.com/SferaDev)! - Add types to exports

- Updated dependencies [[`20cc8c43`](https://github.com/xataio/client-ts/commit/20cc8c43e1659bf112ae2642948c84bfcf46a6ba), [`5099cbbd`](https://github.com/xataio/client-ts/commit/5099cbbd3065a60dcee2f1699afa1ee8ed5edb1c), [`89375e76`](https://github.com/xataio/client-ts/commit/89375e76b790fed7e6a26bf3ac4ea9eaed1aecae), [`5eaee932`](https://github.com/xataio/client-ts/commit/5eaee932b828907ae352d7c0d0584e860845434b), [`109b8790`](https://github.com/xataio/client-ts/commit/109b8790849532d9c442e7c03c67792aeafebd88)]:
  - @xata.io/client@0.23.5

## 0.3.13

### Patch Changes

- Updated dependencies [[`470cc71f`](https://github.com/xataio/client-ts/commit/470cc71f7c5c8b9fd50f789e157d2b2eecd0b3e8)]:
  - @xata.io/client@0.23.4

## 0.3.12

### Patch Changes

- Updated dependencies [[`344b0d68`](https://github.com/xataio/client-ts/commit/344b0d687962d569872d1e90d59818d28df7579c)]:
  - @xata.io/client@0.23.3

## 0.3.11

### Patch Changes

- Updated dependencies [[`c477c177`](https://github.com/xataio/client-ts/commit/c477c17795c01cbf945be413217944a5a38655a5), [`ecdc6553`](https://github.com/xataio/client-ts/commit/ecdc6553d4628289e88953ab6296b80f60e8f757)]:
  - @xata.io/client@0.23.2

## 0.3.10

### Patch Changes

- Updated dependencies [[`3026d708`](https://github.com/xataio/client-ts/commit/3026d70847830fd0f2024413d823380ff323806c)]:
  - @xata.io/client@0.23.1

## 0.3.9

### Patch Changes

- Updated dependencies [[`5838113f`](https://github.com/xataio/client-ts/commit/5838113fca042163b44d7cc7cc1686d5ef89b302)]:
  - @xata.io/client@0.23.0

## 0.3.8

### Patch Changes

- Updated dependencies [[`22e7dd29`](https://github.com/xataio/client-ts/commit/22e7dd29f7a51dccc087d5fd7fff32084c7733af), [`07fc879d`](https://github.com/xataio/client-ts/commit/07fc879d3f778536e39588e66d7a18b5a9d52ebe), [`58a1c24e`](https://github.com/xataio/client-ts/commit/58a1c24e5d30025dce243eecce44f09d4f65ed66), [`c2c6e244`](https://github.com/xataio/client-ts/commit/c2c6e24459b1acc07f0414066258071fbcf7dde9)]:
  - @xata.io/client@0.22.4

## 0.3.7

### Patch Changes

- Updated dependencies [[`4210b8c3`](https://github.com/xataio/client-ts/commit/4210b8c3c4169ba781a56deed7ba09c99788db1f)]:
  - @xata.io/client@0.22.3

## 0.3.6

### Patch Changes

- Updated dependencies [[`72e13bf9`](https://github.com/xataio/client-ts/commit/72e13bf99d0ebefef91c984a995a28b0e8ca2a8f)]:
  - @xata.io/client@0.22.2

## 0.3.5

### Patch Changes

- Updated dependencies [[`4cafde72`](https://github.com/xataio/client-ts/commit/4cafde728e4e9e5e83812d475d9980397ae78362), [`639710a5`](https://github.com/xataio/client-ts/commit/639710a52132f260bf3a26560a21ae2193abb71d)]:
  - @xata.io/client@0.22.1

## 0.3.4

### Patch Changes

- [#877](https://github.com/xataio/client-ts/pull/877) [`f9b966df`](https://github.com/xataio/client-ts/commit/f9b966dfb86aeee5afa711aa7db5cb3e75615d2d) Thanks [@SferaDev](https://github.com/SferaDev)! - Expose random data command programmatically

## 0.3.3

### Patch Changes

- Updated dependencies [[`b2a4def4`](https://github.com/xataio/client-ts/commit/b2a4def4baf3eb18cd323895635e0bccb7f876f4), [`379e6144`](https://github.com/xataio/client-ts/commit/379e61446b21e7cbadd7fc59267736c6845ec566)]:
  - @xata.io/client@0.22.0

## 0.3.2

### Patch Changes

- Updated dependencies [[`b131040a`](https://github.com/xataio/client-ts/commit/b131040a2d142c4e71a2e586fbf05cd9295af9a1), [`7ea810dc`](https://github.com/xataio/client-ts/commit/7ea810dc083ec284447e3bd27bd0465f887481e6), [`d124cbfb`](https://github.com/xataio/client-ts/commit/d124cbfb93d3d591e79bbe9e94c4b6304d825e71), [`d124cbfb`](https://github.com/xataio/client-ts/commit/d124cbfb93d3d591e79bbe9e94c4b6304d825e71), [`fb5ccdf9`](https://github.com/xataio/client-ts/commit/fb5ccdf9fa95c37d54fbc5d9c0bb45872c831609), [`7da604d2`](https://github.com/xataio/client-ts/commit/7da604d27990e20ecadba6122434fca563e6a8c9), [`4ae00036`](https://github.com/xataio/client-ts/commit/4ae00036b53c6c89e02a1fcfdd992f1a3c22892c), [`bdae6668`](https://github.com/xataio/client-ts/commit/bdae6668fb571d29f1b1068a54f6866a80d9b174), [`9486bdcc`](https://github.com/xataio/client-ts/commit/9486bdccc0af567bc5f2e8f91592b0143c539c45), [`9486bdcc`](https://github.com/xataio/client-ts/commit/9486bdccc0af567bc5f2e8f91592b0143c539c45)]:
  - @xata.io/client@0.21.0

## 0.3.1

### Patch Changes

- Updated dependencies [[`6cbeaa0`](https://github.com/xataio/client-ts/commit/6cbeaa00050b5aa99ab7c98052a906487263e026), [`a5a9aa5`](https://github.com/xataio/client-ts/commit/a5a9aa59987faa1d3d701d7431b8a96031e01ac7), [`c64b2eb`](https://github.com/xataio/client-ts/commit/c64b2eb9add70e75d419d418ab9608caac0dbfa1), [`485b217`](https://github.com/xataio/client-ts/commit/485b217079c4b2091d697e68622c48eddd130ceb), [`4d7499c`](https://github.com/xataio/client-ts/commit/4d7499ccbb135691350334fd8022f7a5da41c5f2)]:
  - @xata.io/client@0.20.0

## 0.3.0

### Minor Changes

- [#692](https://github.com/xataio/client-ts/pull/692) [`c8def01`](https://github.com/xataio/client-ts/commit/c8def013e9e2d5b634cdb2850f757a0b3e9e0a6d) Thanks [@SferaDev](https://github.com/SferaDev)! - Update OpenAPI spec methods

### Patch Changes

- Updated dependencies [[`f80f051`](https://github.com/xataio/client-ts/commit/f80f05118dd0588861b8229114a469f016ef77ac), [`c14f431`](https://github.com/xataio/client-ts/commit/c14f431db020036ab2b059bcc52a5d56b321c8e7), [`2e341e5`](https://github.com/xataio/client-ts/commit/2e341e5c6140f9c4ddd74e479049992c26c43ea2), [`c8def01`](https://github.com/xataio/client-ts/commit/c8def013e9e2d5b634cdb2850f757a0b3e9e0a6d), [`f2f749f`](https://github.com/xataio/client-ts/commit/f2f749f4c64246a303da8d4a617773fc55c1d021), [`f2f749f`](https://github.com/xataio/client-ts/commit/f2f749f4c64246a303da8d4a617773fc55c1d021)]:
  - @xata.io/client@0.19.0

## 0.2.9

### Patch Changes

- [#653](https://github.com/xataio/client-ts/pull/653) [`7613417`](https://github.com/xataio/client-ts/commit/7613417fba2c09ebdd5e743f778a5ea642baffa2) Thanks [@SferaDev](https://github.com/SferaDev)! - Allow passing skip rows option to importer

- Updated dependencies [[`b8d441f`](https://github.com/xataio/client-ts/commit/b8d441f80867322f41989d52c94bba230632782b)]:
  - @xata.io/client@0.18.4

## 0.2.8

### Patch Changes

- Updated dependencies [[`330b076`](https://github.com/xataio/client-ts/commit/330b076a0781e3576c82afab76e3fb2a64f2e041), [`c3dfb4b`](https://github.com/xataio/client-ts/commit/c3dfb4babc990634b9e9747616ed93223178a2e7), [`699beb4`](https://github.com/xataio/client-ts/commit/699beb4bbf21cffa001d3f88a03246980e30250b), [`74b17aa`](https://github.com/xataio/client-ts/commit/74b17aaedc0dbdd79bfdcb182b2e70b61f98f5a5), [`83f20cd`](https://github.com/xataio/client-ts/commit/83f20cdbe53706c16016c4db3f318e679b24ec86), [`addfcc6`](https://github.com/xataio/client-ts/commit/addfcc67fca663defdd340111ea09c9188bad3ab), [`eb7ba59`](https://github.com/xataio/client-ts/commit/eb7ba594be2a1f0ab90956836bbeb912e188a46d), [`f1a0742`](https://github.com/xataio/client-ts/commit/f1a0742a04e1aefab14f46371a04a41069faec01)]:
  - @xata.io/client@0.18.0

## 0.2.7

### Patch Changes

- [#591](https://github.com/xataio/client-ts/pull/591) [`30e9271`](https://github.com/xataio/client-ts/commit/30e92716b676a2901a4a63d2fd07d047879e3e23) Thanks [@SferaDev](https://github.com/SferaDev)! - Importer: Export parseCSVString

* [#569](https://github.com/xataio/client-ts/pull/569) [`b14f85f`](https://github.com/xataio/client-ts/commit/b14f85f507730819e23d52792cb0ed072a1d2a3c) Thanks [@SferaDev](https://github.com/SferaDev)! - Importer: Allow passing custom batch size and increase default to 1000

- [#569](https://github.com/xataio/client-ts/pull/569) [`b14f85f`](https://github.com/xataio/client-ts/commit/b14f85f507730819e23d52792cb0ed072a1d2a3c) Thanks [@SferaDev](https://github.com/SferaDev)! - Importer: Add support for id, link and datetime columns

- Updated dependencies [[`a305072`](https://github.com/xataio/client-ts/commit/a3050726517632b4975f2a2ed5f771dd247e51d5), [`7812a41`](https://github.com/xataio/client-ts/commit/7812a414b7d99e9515c0ce48a61ad7a8b84d65d0), [`d4a8ced`](https://github.com/xataio/client-ts/commit/d4a8ced9c257058ed7f660e01ee5fd1da154c391), [`cf85b13`](https://github.com/xataio/client-ts/commit/cf85b13e1ca69e79100fd02f58d79d556012395d), [`2350739`](https://github.com/xataio/client-ts/commit/2350739d3f0a176b0f1fc77b0f4f597321349726), [`a336e61`](https://github.com/xataio/client-ts/commit/a336e6161be04a652e6f0f0a4c2edac10d50c99e)]:
  - @xata.io/client@0.17.1

## 0.2.6

### Patch Changes

- Updated dependencies [[`26e91d1`](https://github.com/xataio/client-ts/commit/26e91d1d84df082dedd7159271fc7c27ec87fefe), [`3332d43`](https://github.com/xataio/client-ts/commit/3332d43121367f61c8d87dfb7da2af65bd1c278f)]:
  - @xata.io/client@0.17.0

## 0.2.5

### Patch Changes

- Updated dependencies [[`6a96ea5`](https://github.com/xataio/client-ts/commit/6a96ea5da4c5b7ca9a99b57ebbce8d6766b5d4d8), [`43f2560`](https://github.com/xataio/client-ts/commit/43f25605ddd0d2fd514a1542a14389d28955c500), [`a9cbb26`](https://github.com/xataio/client-ts/commit/a9cbb263fbca47cb91a827db252d95a5bb4079a6), [`7e04a3d`](https://github.com/xataio/client-ts/commit/7e04a3d1c51958a44f687a0036ead8bb3f5a2dfb)]:
  - @xata.io/client@0.16.0

## 0.2.4

### Patch Changes

- Updated dependencies [[`e923d11`](https://github.com/xataio/client-ts/commit/e923d11fe357519dc4ca3ae722670e6e70ccd1c6), [`599b52c`](https://github.com/xataio/client-ts/commit/599b52c3090222eedef85d1ad1e907874cd3e801)]:
  - @xata.io/client@0.15.0

## 0.2.3

### Patch Changes

- [#482](https://github.com/xataio/client-ts/pull/482) [`5f83ad1`](https://github.com/xataio/client-ts/commit/5f83ad176e0833bf43b26fcb085e43de44891dc7) Thanks [@gimenete](https://github.com/gimenete)! - Deleted deprecated binaries

- Updated dependencies [[`7547b7e`](https://github.com/xataio/client-ts/commit/7547b7edbc9a95c6620784cc5348316f27502c73), [`8812380`](https://github.com/xataio/client-ts/commit/881238062b5eeac2dc8b9ba156720e0acc22c5c5), [`0584a5b`](https://github.com/xataio/client-ts/commit/0584a5b207a21dbc36ddc1d44b276f1d5bb60dc5), [`8d8a912`](https://github.com/xataio/client-ts/commit/8d8a9129e36452266c4c12fe35b421f66e572498), [`e99010c`](https://github.com/xataio/client-ts/commit/e99010c9ab9d355abadcfbcf98b5a3fcc80c307a), [`c4be404`](https://github.com/xataio/client-ts/commit/c4be404a3ecb34df9b1ef4501c92f5bdc221f19c)]:
  - @xata.io/client@0.14.0

## 0.2.2

### Patch Changes

- Updated dependencies [[`c9f34ad`](https://github.com/xataio/client-ts/commit/c9f34ad37d75203083a1dec2fac2b03e096521af), [`5f82e43`](https://github.com/xataio/client-ts/commit/5f82e4394010f40dcbf3faf2d0bdb58a6fc1c37a)]:
  - @xata.io/client@0.13.0

## 0.2.1

### Patch Changes

- Updated dependencies [[`db3c88e`](https://github.com/xataio/client-ts/commit/db3c88e1f2bee6d308afb8d6e95b7c090a87e7a7), [`1cde95f`](https://github.com/xataio/client-ts/commit/1cde95f05a6b9fbf0564ea05400140f0cef41a3a), [`57bf0e2`](https://github.com/xataio/client-ts/commit/57bf0e2e049ed0498683ff42d287983f295342b7)]:
  - @xata.io/client@0.12.0

## 0.2.0

### Minor Changes

- [#339](https://github.com/xataio/client-ts/pull/339) [`aeafe54`](https://github.com/xataio/client-ts/commit/aeafe54b53e203cf9357b4f4cfd648fa303be38a) Thanks [@gimenete](https://github.com/gimenete)! - Move importer command to CLI

### Patch Changes

- [#344](https://github.com/xataio/client-ts/pull/344) [`bcfad72`](https://github.com/xataio/client-ts/commit/bcfad722e26aac6010f3994d3b1b1f7df21f2c76) Thanks [@gimenete](https://github.com/gimenete)! - Fix too permissive regular expression in importer package

## 0.1.4

### Patch Changes

- Updated dependencies [[`6d76275`](https://github.com/xataio/client-ts/commit/6d7627555a404a4c2da42f4187df6f8300f9a46f), [`d1ec0df`](https://github.com/xataio/client-ts/commit/d1ec0df14834088a816919bfc68216f3f9b2d9ef), [`1864742`](https://github.com/xataio/client-ts/commit/18647428d8608841de514c3784fb711c39dccc6d), [`1af6f1a`](https://github.com/xataio/client-ts/commit/1af6f1aaa1123e77a895961581c87f06a88db698), [`be4eda8`](https://github.com/xataio/client-ts/commit/be4eda8f73037d97fef7de28b56d7471dd867875), [`99be734`](https://github.com/xataio/client-ts/commit/99be734827576d888aa12a579ed1983a0a8a8e83)]:
  - @xata.io/client@0.10.0

## 0.1.3

### Patch Changes

- Updated dependencies [[`2fc2788`](https://github.com/xataio/client-ts/commit/2fc2788e583c047ffb2cd693f053f60ce608149c), [`a96da7c`](https://github.com/xataio/client-ts/commit/a96da7c8b548604ed25001390992531537675a44), [`e8d595f`](https://github.com/xataio/client-ts/commit/e8d595f54efe126b39c78cc771a5d69c551f4fba), [`c4dcd11`](https://github.com/xataio/client-ts/commit/c4dcd110d8f9dc3a7e4510f2f00257c9109e51fa), [`2848894`](https://github.com/xataio/client-ts/commit/284889446bbac5d6737086bf01a588d97b841730)]:
  - @xata.io/client@0.9.0

## 0.1.2

### Patch Changes

- Update dependencies [bde908e]

## 0.1.1

### Patch Changes

- 532e3bb: Fix processing files larger than the batch size

## 0.1.0

### Minor Changes

- 98fbe77: Initial version supporting CSV files
