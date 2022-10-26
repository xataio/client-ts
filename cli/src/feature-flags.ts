export const flags = (process.env.XATA_CLI_FLAGS || '')
  .split(',')
  .map((s) => s.toLocaleLowerCase().trim())
  .filter(Boolean);

export const features = {
  //flagName: flags.includes('flagName')
};
