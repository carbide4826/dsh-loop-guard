# dsh-loop-guard

Guard against repetitive tool-call loops with threshold-based interruption.

[简体中文](https://github.com/carbide4826/dsh-loop-guard/blob/main/README.md)

> Generated with [dshp](https://github.com/carbide4826/dsh-plugin-cli) · dsh plugin CLI scaffold

A dsh plugin: it detects the model calling the same tool over and over — first it warns, then it refuses to run the call, and when needed it ends the whole turn.

## How it works

Every tool call produces a signature, decided by the tool name and its arguments (same tool, same arguments = same signature). Signatures are recorded in a per-agent list of the last N calls, where N is `capacity`: once the list is full the oldest entry falls off, and what is counted is calls, not time. Based on how many times one signature appears in that list, the guard acts in three steps:

- At threshold-1: a short warning is injected into the conversation, telling the model this call was just made — change the arguments or stop
- From threshold on: the call is stopped before it executes. The tool never runs, and the model gets back a "blocked repeat" error result
- Once the same signature reaches `terminateAt`: this step is cut and the turn ends, skipping every remaining model call — which is where the tokens actually burn

A few choices that keep normal work from being flagged:

- When the user says something mid-turn, that agent's list is cleared and counting restarts
- Different arguments mean a different signature, counted separately. The gain is that "adjust a little each round" tasks are never mistaken for a loop; the price is that a loop which tweaks its arguments slightly every time is never counted — accepted on purpose
- Tools listed in `exempt` take no part in counting at all, and all three actions stay blind to them

**Heads-up: a conversation can appear to stop mid-sentence.**

- What it looks like: when a signature reaches `terminateAt`, the guard ends the turn before the model gets to say anything closing — after the last tool row the UI just goes quiet. It looks like an unexplained abort; it's the termination line working
- How to check: open the trajectory view or the tool details. A loop-guard warning row, or a denied tool row whose text contains `blocked repeat`, means the guard is intervening; if neither is there, the cause is something else
- How to recover: nothing is locked. Any new user message resets the counters and the conversation continues normally. See Planned below for making the stop self-explanatory

## Configuration

```yaml
config:
  granularity: normalized   # exact = raw arguments feed the hash; normalized = arguments are normalized first (default)
  capacity: 12              # required, sliding-window size, integer >= 1
  threshold: 3              # required, repeat count that triggers denial, integer >= 2 and <= capacity
  terminateAt: 8            # optional, termination line, integer > threshold and <= capacity; omitted = no termination
  exempt:                   # optional, whitelist matched as a fingerprint prefix (a tool name exempts all its calls)
    - bash
```

`capacity` and `threshold` are required and have no defaults: if one is missing the plugin throws at load time and names the missing field. That is deliberate — no silent fallback. Every constraint is checked one by one at load time, and a violation refuses the load.

## Installation

### Official plugin management page

Fill in any one of these at the install entry:

| Source | Value |
| --- | --- |
| npm package | `dsh-loop-guard` |
| GitHub repository | `https://github.com/carbide4826/dsh-loop-guard` |
| Local directory | the absolute path where you cloned this repo (e.g. `<your-directory>/dsh-loop-guard`) |

### Command line install

One shape for all three: `dsh plugin --profile <name> add <source>` — the arguments are forwarded verbatim to pnpm, which installs into the profile.

**1. npm package (published releases)**

```sh
dsh plugin --profile web add dsh-loop-guard
```

**2. GitHub repository (installable before release, straight from git)**

```sh
dsh plugin --profile web add github:carbide4826/dsh-loop-guard
```

This repo hooks tsdown into prepare, so installing from a git source builds dist/ on your machine automatically. pnpm blocks build scripts by default: add the key printed in the error to `allowBuilds` in the profile directory's `pnpm-workspace.yaml`, then re-run the add.

**3. Local directory (repo under development)**

```sh
dsh plugin --profile web add /path/to/dsh-loop-guard   # from this repo's root you can write .
```

This installs the build output: run `pnpm build` first to produce `dist/`, and after any source change re-run build + add.

All three pull in the registration lines from `cordis.patch.yml` automatically at boot, via the package's `dsh.bundle.patch` declaration. During development, if you don't want to write into the profile, use `dsh web --patch <file.yml>` as a temporary overlay (applied after the profile layer, whole-entry replacement by id, repeatable; a patch whose `name` is an absolute path loads `.ts` source directly — edit and re-run, no build needed).

After installing, `capacity`/`threshold` still have to be set in the profile (or patch): required, no defaults, missing means a throw at load time. A started server prints its Web address (default `http://127.0.0.1:3080`), which means the plugin's apply ran successfully.

## Development

```sh
pnpm install
pnpm add -D @deepseek-ai/dsh@0.1.7-rc.2   # the host CLI; the dsh commands above use it (skip if dsh is installed globally)
pnpm build                        # tsdown -> dist/
pnpm typecheck                    # tsc --noEmit
```

After the first install, run `pnpm approve-builds` as pnpm suggests, to allow the build scripts of node-pty / koffi / @deepseek-ai/dsh-subprocess-local.

`dev.patch.yml` in this repo is the local overlay for option 3 (it contains an absolute path, is gitignored, and is not committed).

## Repository layout

```
src/index.ts          entry: Config type + schema + apply (validate, build state table, register)
src/chain.ts          counters: fixed-size sliding window per agent + load-time parameter validation
src/fingerprint.ts    signature: stable serialization, exact / normalized
src/warning.ts        warning message construction (its own loop-guard message source)
src/events.ts         event domain aggregation
src/domains/tools.ts  post-execute counting + warning, pre-execute denial
src/domains/agent.ts  pre-step chain clearing and termination
```

The dependency line tracks dsh; `@deepseek-ai/dsh-*` is pinned at 0.1.7-rc.2. Node requirement: `^22.19.0 || >=24.0.0`.

## Planned

- **Last word step**: on reaching the termination line, let the final call through so the model can give the user a one-line summary of the current state, then close the turn.

## Changelog

Full history: [CHANGELOG.en.md](https://github.com/carbide4826/dsh-loop-guard/blob/main/CHANGELOG.en.md).

## License

MIT, see [LICENSE](https://github.com/carbide4826/dsh-loop-guard/blob/main/LICENSE).
