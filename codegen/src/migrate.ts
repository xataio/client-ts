import { execSync } from 'child_process';
import { copyFileSync, unlinkSync } from 'fs';
import inquirer from 'inquirer';

async function main() {
  const now = Date.now();
  const file = `migration-${now}.ts`;

  copyFileSync('migration-template.ts', file);
  execSync(`code -w ${file}`);
  unlinkSync(file);

  const response = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      initial: true,
      message: `This migration is going to be run on [test:main]. Do you want to proceed?`
    }
  ]);

  if (!response.confirm) {
    console.log('Ok, bye!');
    return;
  }

  console.log('Done! Your database is updated');
}

main().catch(console.error);
