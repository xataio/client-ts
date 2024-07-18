export const matrixToOclif = (os: string) => {
  switch (os) {
    case 'macos-latest':
      return 'macos';
    case 'ubuntu-latest':
      return 'deb';
    case 'windows-latest':
      return 'win';
    default:
      throw new Error('Unsupported OS');
  }
};

export const platformDistributions = (os: string) => {
  switch (os) {
    case 'macos':
      return 'darwin-arm64,darwin-x64';
    case 'deb':
      return 'linux-arm,linux-arm64,linux-x64';
    case 'win':
      return 'win32-x64,win32-x86';
    default:
      throw new Error('Unsupported Platform');
  }
};

export const publishedPackagesContains = (publishedPackages: string, packageName: string) => {
  if (
    publishedPackages === '' ||
    !(JSON.parse(publishedPackages) as Array<{ name: string; version: string }>).find(
      (change) => change.name === packageName
    )
  ) {
    console.log('No changes in cli. Skipping asset release.');
    return false;
  }
  return true;
};
