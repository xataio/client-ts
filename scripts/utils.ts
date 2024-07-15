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
