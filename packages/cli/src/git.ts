import { spawnSync } from 'child_process';

export function isIgnored(path: string) {
  try {
    run('git', ['check-ignore', path]);
    return true;
  } catch (err) {
    return false;
  }
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { encoding: 'utf-8', shell: true });
  if (result.error) throw result.error;
  if (result.status && result.status > 0) throw new Error(result.output.filter(Boolean).join('\n'));
  return result.output.filter(Boolean).join('\n').trim();
}
