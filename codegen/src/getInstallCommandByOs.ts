export const getCliInstallCommandsByOs = (os: NodeJS.Platform) => {
  switch (os) {
    case 'win32':
      return 'iwr https://xata.io/install.ps1 -useb | iex';
    case 'linux':
    case 'darwin':
      return 'curl -L  https://xata.io/install.sh | sh';
    default:
      throw new Error(`It seems your operating system isn't supported by the Xata CLI. Please open an issue about this on GitHub and we'll add support as soon as possible.
        
  To open an issue, click here:
  https://github.com/xataio/cli/issues/new`);
  }
};
