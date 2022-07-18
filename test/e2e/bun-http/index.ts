import { execSync } from 'child_process';

async function main() {
  const result = execSync(`bun test.ts`, { cwd: __dirname }).toString();
  console.log(result);
}

main();
