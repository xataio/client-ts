import { Hook } from '@oclif/core';
import { getSdkVersion } from './init/compatibility';

// TODO: Remove this check when pgroll branches are enabled everywhere
const hook: Hook<'codegen:generated'> = async function (options) {
  const { pgrollEnabled } = options;

  if (pgrollEnabled) {
    const sdkVersion = await getSdkVersion();
    if (sdkVersion && sdkVersion !== 'next') {
      this.warn(
        "Since you are working with a pgroll enabled branch, we recommend using the 'next' version of the SDK. Run `npm install @xata.io/client@next` to update."
      );
    }
  }
};

export default hook;
