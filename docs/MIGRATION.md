# Migration analysis and generated units

## Architecture

```text
apps/web/             React + Vite UI, local ZIP export (fflate)
packages/core/        UI-independent TypeScript converter, YAML parsing (yaml)
tests/fixtures/       Representative Compose inputs
tests/                Converter and ZIP tests (Vitest)
.github/workflows/    CI and GitHub Pages deployment
AGENTS.md             Project rules for contributors and coding agents
```

npm workspaces connect app and core. Core imports neither React nor browser APIs. The web bundle includes the converter and its dependencies.

```text
Compose -> parser -> migration analyzer / mapping plan
        -> preview generator -> export safety gate
```

`parser.ts` owns bounded YAML parsing/normalization. `planner.ts` validates Compose settings and records candidate mappings using the existing diagnostics. `analyzer.ts` projects those diagnostics and mapped directives into structured findings; it does not parse diagnostic prose. `capabilities.ts` centralizes verified directive requirements. `preview.ts` permits only explicitly understood omissions, then the public API applies the whole-document export gate. The analyzer has no UI or host-runtime dependency.

```ts
import { convertCompose } from "@quadletlens/core";

const result = convertCompose(`services:
  web:
    image: nginx:latest
    ports: ["8080:80"]
`);
// files: { filename: string; content: string }[]
// diagnostics: { severity: 'info' | 'warning' | 'error';
//   code: string; path: string; message: string }[]
```

### Migration analysis API

`analyzeCompose(source, { targetPodmanVersion?: "5.2.0" })` and the backwards-compatible `convertCompose` entry point return the same result:

- `files`: exportable files only. Any blocking finding keeps this empty, including an insufficient/invalid target version.
- `previewFiles`: `{ filename, content, exportable, blockedBy, relatedBlockers }[]`. Blocker arrays reference stable finding IDs within the result. While blocked, **all** previews are non-exportable, including files with no local blocker. They contain a preview-only comment and per-file omitted paths.
- `findings`: machine-readable code, severity, category, service, source path, feature, summary, remediation key, optional diagnostic reference and target requirement/evidence. Every original diagnostic remains present exactly once in this projection; successful mappings are separate findings.
- `summary`: readiness, recognized resource counts (including implicit default network), category **finding counts**, mutually exclusive service status counts, blocking/affected/manual-service counts and logging counts. Direct/review/manual counts are not mutually exclusive service totals.
- `services`: per-service readiness and related finding/blocker IDs. READY means accepted mappings, REVIEW means host/semantic review remains; neither guarantees deployment readiness. Global blockers affect every service.
- `diagnostics`: complete legacy diagnostics for compatibility; target-version errors are added through the same analysis pipeline.

Preview is conservative: currently only explicit unsupported logging settings may be omitted with blocking findings. Invalid YAML, unresolved interpolation, invalid values, unknown Compose features, ambiguous network/lifecycle settings and insufficient target versions suppress **the entire preview**. No sanitizing/reparsing or logging removal occurs in production input. No journald substitution or PodmanArgs workaround is generated. Copy, Download and ZIP only use `files`, never `previewFiles`; editing input or target invalidates export until reanalysis.

The unchanged official Harbor fixture analyzes as **11 services, 1 network, 20 logging blockers across 10 services, 12 preview files and 0 exportable files**. PostgreSQL capabilities/shared memory and registry mounts/network remain visible; logging paths and manual migration guidance remain explicit. Preview syntax acceptance is separate from migration completeness.

### Target Podman awareness

Choose unspecified (verify on host) or enter a numeric `major.minor[.patch]` target. There is no assumed latest version or Fedora-to-Podman version mapping. Verified upstream directive baselines gate export for an older target. Unknown minima and unverified value/runtime behavior are marked **runtime verification required**, rather than assigned an invented version. The current capability evidence and limits are documented in [docs/CAPABILITIES.md](CAPABILITIES.md). Current Fedora CI validates actual package versions from each run; it does not prove all historical boundary versions.

`web.container` includes:

```ini
[Container]
Image=nginx:latest
PublishPort=8080:80
Network=network-default.network
NetworkAlias=web
```

A shared default `network-default.network` preserves service-name DNS/connectivity. Files also include unit descriptions and `WantedBy=default.target`. Filenames are `<service>.container`, `network-<key>.network` and `volume-<key>.volume`. Mapping keys and files are sorted deterministically; ordered Compose lists retain their order.

## Using generated units

For rootless Linux, place **all** generated files together in `~/.config/containers/systemd/`. Supply referenced bind mounts/env files at the reviewed host paths, then:

```sh
systemctl --user daemon-reload
systemctl --user start web.service
systemctl --user status web.service
```

The generator applies `[Install]`/`WantedBy=default.target`; do not use `systemctl enable` for generated transient services. User services normally start with the user session; boot without login requires host-side lingering configuration. Review rootful deployments/startup policy separately. Use the installed `podman-system-generator --user --dryrun` on the Linux host to diagnose generator compatibility (see Podman reference for paths).

