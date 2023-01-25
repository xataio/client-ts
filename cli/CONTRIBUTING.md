# Running the CLI locally

(from the root directory of this repo)

`cli/bin/dev.js status`

Sometimes this may not work for some commands

`pnpm build && cli/bin/run.js status`

## Aliases

It's helpful to be able to run the CLI from anywhere:

XATA_CLIENT_TS=~/Workspace/xata/client-ts
alias xatadev="$XATA_CLIENT_TS/cli/bin/dev.js"
alias xatadevbuild="(cd $XATA_CLIENT_TS && pnpm build) && $XATA_CLIENT_TS/cli/bin/run.js"

then: `xatadev status` or `xatadevbuild status`
