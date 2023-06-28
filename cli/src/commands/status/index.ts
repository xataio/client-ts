import chalk from 'chalk';
import { APIKeyLocation, BaseCommand } from '../../base.js';
import { credentialsFilePath, Profile } from '../../credentials.js';

export default class Status extends BaseCommand<typeof Status> {
  static description = 'Print information about the current project configuration';

  static examples = [];

  static flags = {
    ...this.commonFlags
  };

  static args = {};

  async run() {
    if (!this.projectConfig) {
      this.error('No project found. Run `xata init` to create one.');
    }

    const { databaseURL, workspace, database, branch } = await this.getParsedDatabaseURLWithBranch();
    const profile = await this.getProfile();

    if (this.jsonEnabled()) {
      return {
        projectConfigLocation: this.projectConfig,
        databaseURL,
        workspace,
        database,
        branch,
        apiKeyLocation: this.apiKeyLocation
      };
    }

    this.printValue('Project configuration file', this.projectConfigLocation);
    this.printValue('Database URL', databaseURL);
    this.printValue('Branch', branch);
    this.printValue('API key location', this.getAPIKeyLocationDescription(profile, this.apiKeyLocation));
  }

  printValue(name: string, value?: string) {
    this.log(`${name}:`);
    this.log(`${chalk.dim(value || 'Unknown')}`);
    this.log();
  }

  getAPIKeyLocationDescription(profile: Profile, location?: APIKeyLocation) {
    if (!location) return '';
    switch (location) {
      case 'shell':
        return 'XATA_API_KEY environment variable in the current shell';
      case 'dotenv':
        return `XATA_API_KEY environment variable at ${this.apiKeyDotenvLocation}`;
      case 'profile':
        return `Credentials file at ${credentialsFilePath} with ${profile.name} profile`;
      case 'new':
        return 'Newly created API key';
    }
  }
}
