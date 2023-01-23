import { ProjectConfig } from '../config';

export function hasExperimentalFlag(config: ProjectConfig, flag: keyof NonNullable<ProjectConfig['experimental']>) {
  return config.experimental?.[flag] === true;
}

export function hasRemoteFlag() {
  // TODO: implement
}
