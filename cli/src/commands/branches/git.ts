import { execSync } from 'child_process';

export function isWorkingDirClean() {
  const out = run('git status --porcelain=v1');
  return out === '';
}

export function listRemotes() {
  const out = run('git remote -v');
  const items = out.split('\n');
  return items.map((item) => {
    const [name, url, method] = item.split(/\s+/);
    return { name, url, method: method.replace('(', '').replace(')', '') };
  });
}

export function defaultGitBranch(remote?: string) {
  if (!remote) {
    const remotes = listRemotes();
    if (remotes.length === 0) throw new Error('Cannot calculate default git branch. No git remotes found');
    remote = remotes[0].name;
  }
  const out = run(`git symbolic-ref refs/remotes/${remote}/HEAD`);
  if (!out) throw new Error(`Cannot calculate default git branch. No HEAD found for remote ${remote}`);
  return out.replace(`refs/remotes/${remote}/`, '');
}

export function version() {
  const out = run('git --version');
  const match = out.match(/git version (\d+.\d+.\d+)/);
  if (!match) throw new Error('Could not parse git version');
  return match[1];
}

export function isGitInstalled() {
  try {
    // TODO: we could check if the version is greater than a specific version with semver
    version();
    return true;
  } catch (e) {
    return false;
  }
}

export function createBranch(name: string, base: string) {
  run(`git checkout -b ${name} ${base}`);
}

function run(command: string) {
  return execSync(command, { encoding: 'utf-8' }).trim();
}
