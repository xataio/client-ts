export const getCliPlatformFromNodePlatform = () => {
  switch (process.platform) {
    case 'win32':
      return 'windows';
    case 'linux':
    case 'darwin':
      return process.platform;
    default:
      throw new Error('Unsupported OS');
  }
};
