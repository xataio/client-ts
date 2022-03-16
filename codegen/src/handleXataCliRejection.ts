import chalk from 'chalk';
import { Ora } from 'ora';

export const handleXataCliRejection = (spinner: Ora) =>
  spinner.info(
    `You can install the Xata CLI at any time and clone a database locally to enjoy the benefits of ${chalk.bold(
      'code generation and version control with database branching'
    )}. To learn more, visit ${chalk.blueBright('https://docs.xata.io/cli/getting-started')}.
`
  );
