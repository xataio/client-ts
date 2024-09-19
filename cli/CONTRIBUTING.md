# Running the CLI locally

(from the root directory of this repo)

`packages/cli/bin/dev.js status`

Sometimes this may not work for some commands

`pnpm build && packages/cli/bin/run.js status`

## Aliases

It's helpful to be able to run the CLI from anywhere:

XATA_CLIENT_TS=~/Workspace/xata/client-ts
alias xatadev="$XATA_CLIENT_TS/packages/cli/bin/dev.js"
alias xatadevbuild="(cd $XATA_CLIENT_TS && pnpm build) && $XATA_CLIENT_TS/packages/cli/bin/run.js"

then: `xatadev status` or `xatadevbuild status`

To run the CLI against a different profile, you can use:

`./packages/cli/bin/dev.js auth login --profile staging --host staging` where host values can be prod, staging, dev, and controlPlaneUrl, dataPlaneUrl (comma delimited for ephemeral instances or localhost docker)

# Running the CLI against `localhost`

It is possible to run the `xata` CLI against `localhost` (Docker) environments, following these steps:

1. Create a `local` CLI profile

```
xata auth login --profile local --host http://localhost:6001,http://08lcul.dev.localhost:6001
```

where `08lcul` is your local workspace id and `dev` is the name of your local region.

2. Initalize the CLI, specifying the `local` profile:

```
xata init --profile local
```

# Logging in with a deploy preview

To log in with a deploy preview, you can use the following command:

```
xata auth login --profile deploy-preview --host staging --web-host https://xata-p9lbsnxlc-xata.vercel.app
```

where `https://xata-p9lbsnxlc-xata.vercel.app` is the deploy preview URL.

Alternatively you can set the backend of the frontend url with `XATA_WEB_URL` env variable when running any command.
