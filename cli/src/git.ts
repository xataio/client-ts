import { spawnSync } from 'child_process';

export function isGitRepo() {
  try {
    run('git', ['status', '--porcelain=v1']);
    return true;
  } catch (err) {
    if (err instanceof Error && err.message.includes('not a git repository')) return false;
    throw err;
  }
}

export function isWorkingDirClean() {
  const out = run('git', ['status', '--porcelain=v1']);
  return out === '';
}

export function listRemotes() {
  const out = run('git', ['remote', '-v']);
  const items = out.split('\n').filter(Boolean);
  return items.map((item) => {
    const [name, url, method] = item.split(/\s+/);
    return { name, url, method: method.replace('(', '').replace(')', '') };
  });
}

export function currentGitBranch() {
  const out = run('git', ['branch', '--show-current']);
  return out === '' ? null : out;
}

export function listBranches(): { name: string; local: boolean; remotes: string[] }[] {
  const out = run('git', ['for-each-ref', '--format', '%(refname)']);
  const items = out.split('\n').filter(Boolean);

  const branches = items.reduce((acc, item) => {
    const [_prefix, type, ...rest] = item.split(/\//);

    switch (type) {
      case 'heads': {
        const name = rest.join('/');
        acc[name] = { name, local: true, remotes: acc[name]?.remotes ?? [] };
        break;
      }
      case 'remotes': {
        const [remote, ...parts] = rest;
        const name = parts.join('/');
        const prev = acc[name] ?? { local: false, remotes: [] };
        acc[name] = { name, local: prev.local, remotes: [...prev.remotes, remote] };
        break;
      }
    }

    return acc;
  }, {} as Record<string, { name: string; local: boolean; remotes: string[] }>);

  return Object.values(branches);
}

export function defaultGitBranch(remote?: string) {
  if (!remote) {
    const remotes = listRemotes();
    if (remotes.length === 0)
      throw new Error(
        'Cannot calculate default git branch. No git remotes found. Use --from to specify a specific base branch'
      );
    remote = remotes[0].name;
  }
  const out = run('git', ['symbolic-ref', `refs/remotes/${remote}/HEAD`]);
  if (!out)
    throw new Error(
      `Cannot calculate default git branch. No HEAD found for remote ${remote}. Use --from to specify a specific base branch`
    );
  return out.replace(`refs/remotes/${remote}/`, '');
}

export function version() {
  const out = run('git', ['--version']);
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
  run('git', ['checkout', '-b', name, base]);
}

export function isIgnored(path: string) {
  try {
    run('git', ['check-ignore', path]);
    return true;
  } catch (err) {
    return false;
  }
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { encoding: 'utf-8' });
  if (result.error) throw result.error;
  if (result.status && result.status > 0) throw new Error(result.output.filter(Boolean).join('\n'));
  return result.output.filter(Boolean).join('\n').trim();
}
