# oclif-hello-world

oclif example Hello World CLI

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/oclif-hello-world.svg)](https://npmjs.org/package/oclif-hello-world)
[![CircleCI](https://circleci.com/gh/oclif/hello-world/tree/main.svg?style=shield)](https://circleci.com/gh/oclif/hello-world/tree/main)
[![Downloads/week](https://img.shields.io/npm/dw/oclif-hello-world.svg)](https://npmjs.org/package/oclif-hello-world)
[![License](https://img.shields.io/npm/l/oclif-hello-world.svg)](https://github.com/oclif/hello-world/blob/main/package.json)

<!-- toc -->

- [Usage](#usage)
- [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->

```sh-session
$ npm install -g @xata.io/xata
$ xata COMMAND
running command...
$ xata (--version)
@xata.io/xata/0.0.0 darwin-arm64 node-v16.14.0
$ xata --help [COMMAND]
USAGE
  $ xata COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`xata hello PERSON`](#xata-hello-person)
- [`xata hello world`](#xata-hello-world)
- [`xata help [COMMAND]`](#xata-help-command)
- [`xata plugins`](#xata-plugins)
- [`xata plugins:install PLUGIN...`](#xata-pluginsinstall-plugin)
- [`xata plugins:inspect PLUGIN...`](#xata-pluginsinspect-plugin)
- [`xata plugins:install PLUGIN...`](#xata-pluginsinstall-plugin-1)
- [`xata plugins:link PLUGIN`](#xata-pluginslink-plugin)
- [`xata plugins:uninstall PLUGIN...`](#xata-pluginsuninstall-plugin)
- [`xata plugins:uninstall PLUGIN...`](#xata-pluginsuninstall-plugin-1)
- [`xata plugins:uninstall PLUGIN...`](#xata-pluginsuninstall-plugin-2)
- [`xata plugins update`](#xata-plugins-update)

## `xata hello PERSON`

Say hello

```
USAGE
  $ xata hello [PERSON] -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Whom is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ oex hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [dist/commands/hello/index.ts](https://github.com/xataio/client-ts/blob/v0.0.0/dist/commands/hello/index.ts)_

## `xata hello world`

Say hello world

```
USAGE
  $ xata hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ oex hello world
  hello world! (./src/commands/hello/world.ts)
```

## `xata help [COMMAND]`

Display help for xata.

```
USAGE
  $ xata help [COMMAND] [-n]

ARGUMENTS
  COMMAND  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for xata.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.1.12/src/commands/help.ts)_

## `xata plugins`

List installed plugins.

```
USAGE
  $ xata plugins [--core]

FLAGS
  --core  Show core plugins.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ xata plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.0.11/src/commands/plugins/index.ts)_

## `xata plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ xata plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installs a plugin into the CLI.

  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.

ALIASES
  $ xata plugins add

EXAMPLES
  $ xata plugins:install myplugin

  $ xata plugins:install https://github.com/someuser/someplugin

  $ xata plugins:install someuser/someplugin
```

## `xata plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ xata plugins:inspect PLUGIN...

ARGUMENTS
  PLUGIN  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ xata plugins:inspect myplugin
```

## `xata plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ xata plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installs a plugin into the CLI.

  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.

ALIASES
  $ xata plugins add

EXAMPLES
  $ xata plugins:install myplugin

  $ xata plugins:install https://github.com/someuser/someplugin

  $ xata plugins:install someuser/someplugin
```

## `xata plugins:link PLUGIN`

Links a plugin into the CLI for development.

```
USAGE
  $ xata plugins:link PLUGIN

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.

EXAMPLES
  $ xata plugins:link myplugin
```

## `xata plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ xata plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ xata plugins unlink
  $ xata plugins remove
```

## `xata plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ xata plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ xata plugins unlink
  $ xata plugins remove
```

## `xata plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ xata plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ xata plugins unlink
  $ xata plugins remove
```

## `xata plugins update`

Update installed plugins.

```
USAGE
  $ xata plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

<!-- commandsstop -->
