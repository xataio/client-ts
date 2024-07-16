export const matrixToOclif = (os: string) => {
  switch (os) {
    case 'macos-latest':
      return 'macos';
    case 'ubuntu-latest':
      return 'deb';
    default:
      throw new Error('Unsupported OS');
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
