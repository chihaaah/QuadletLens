# Compose2Quadlet

A browser-local Docker Compose to Podman Quadlet migration analyzer and converter. Inspect compatibility, semantic differences, manual migration work and target Podman requirements, then review `.container`, `.network`, and `.volume` previews before exporting.

**Status:** conservative migration analysis with a supported Compose subset and real Quadlet generator validation in CI. Processing stays local; unsupported settings block export instead of disappearing. This is not a Docker Compose runtime, deployment orchestrator or drop-in `docker compose` replacement, and does not guarantee applications will run correctly after migration. It provides no lifecycle commands or remote deployment.

## Local development

Requirements: Git and Node.js **22.12+** (Node 24 LTS recommended), with npm. Podman is not needed to run the website.

```sh
git clone https://github.com/chihaaah/compose2quadlet.git
cd compose2quadlet
npm install
npm run dev
```

Open Vite's localhost URL (normally `http://127.0.0.1:5173`). Paste YAML or open/drop one `.yml`/`.yaml` file, select **Convert**, review diagnostics, then select a generated file to copy/download it or download everything as ZIP. Editing input disables exports until the next conversion. Use EN / JP for English/Japanese and the theme toggle for light/dark mode; preferences persist locally. Initial defaults follow the browser language and system color scheme. See [DESIGN.md](DESIGN.md) for the UI design rules.

```sh
npm test                # Converter, ZIP and UI preference tests
npm run test:watch      # Vitest watch mode
npm run typecheck       # Strict TypeScript checks
npm run build           # Typecheck, core declarations/JS, production web bundle
npm run preview --workspace @compose2quadlet/web
```

Serve `apps/web/dist` using any static web host. No application server is required.

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
import { convertCompose } from "@compose2quadlet/core";

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

Choose unspecified (verify on host) or enter a numeric `major.minor[.patch]` target. There is no assumed latest version or Fedora-to-Podman version mapping. Verified upstream directive baselines gate export for an older target. Unknown minima and unverified value/runtime behavior are marked **runtime verification required**, rather than assigned an invented version. The current capability evidence and limits are documented in [docs/CAPABILITIES.md](docs/CAPABILITIES.md). Current Fedora CI validates actual package versions from each run; it does not prove all historical boundary versions.

`web.container` includes:

```ini
[Container]
Image=nginx:latest
PublishPort=8080:80
Network=network-default.network
NetworkAlias=web
```

A shared default `network-default.network` preserves service-name DNS/connectivity. Files also include unit descriptions and `WantedBy=default.target`. Filenames are `<service>.container`, `network-<key>.network` and `volume-<key>.volume`. Mapping keys and files are sorted deterministically; ordered Compose lists retain their order.

## Supported features

| Compose field           | Mapping / boundary                                                                                                                                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `services`, `image`     | One `.container` per service; literal image required. No image builds.                                                                                                                                                                                                                                             |
| `container_name`        | `ContainerName`, validated names/collisions. Default: Quadlet's `systemd-<service>`.                                                                                                                                                                                                                               |
| `ports`                 | `PublishPort`; short syntax, matching ranges, TCP/UDP, host IPv4/IPv6. Long syntax supports `target`, `published`, `host_ip`, `protocol`, `mode: host`. Swarm ingress/other options are errors.                                                                                                                    |
| `environment`           | Mapping or `KEY=value` list to quoted `Environment`. Scalars and explicit empty values supported. Null/bare names are errors: browser cannot resolve host inheritance.                                                                                                                                             |
| `env_file`              | String or ordered string list to `EnvironmentFile`. References only; files are never read/packaged. Review host paths and Compose/Podman interpolation/quoting differences. No long syntax.                                                                                                                        |
| `volumes`               | Declared named volumes and Linux bind paths. Short options: `ro`, `rw`, `z`, `Z`. Long fields: `type`, `source`, `target`, `read_only`. No anonymous mounts, Windows paths, subpaths or advanced options.                                                                                                          |
| Top-level `volumes`     | `.volume`, explicit `name`, default `driver: local`, boolean `external`. External volumes must already exist.                                                                                                                                                                                                      |
| `networks`              | Service list or mapping with empty/null attachment settings. Shared default network and service-name `NetworkAlias`. No per-attachment options.                                                                                                                                                                    |
| Top-level `networks`    | `.network`, explicit `name`, default `driver: bridge`, boolean `external`. External networks must already exist. No IPAM/driver options.                                                                                                                                                                           |
| `command`, `entrypoint` | Exec arrays or simple unquoted, unescaped space-separated strings. Use arrays for quoting/shell commands. Null retains image defaults. Empty CMD/empty arguments are errors. Entrypoint uses JSON array syntax, including `[]`, and requires explicit non-empty command to avoid unexpected image CMD inheritance. |
| `user`, `working_dir`   | Container `User` (`user[:group]`, numeric UID supported) and absolute Linux `WorkingDir`. Does not change the systemd host user.                                                                                                                                                                                   |
| `restart`               | Systemd `Restart`: `no`, `always`, `on-failure`. `unless-stopped` approximates `always`. Review rate limits and reboot/manual-stop differences. No bounded retries.                                                                                                                                                |
| `depends_on`            | Short list or long `condition: service_started`, `required: true`, `restart: false`. `Requires`/`After` with lifecycle/readiness warning. Cycles, missing services and health/completion gates are errors.                                                                                                         |
| `version`, `x-*`        | Obsolete version/extension metadata produce info diagnostics. YAML anchors and merge keys supported.                                                                                                                                                                                                               |

Managed resources default to Quadlet's `systemd-` names rather than Compose project names. Warnings call out data migration and network isolation; use explicit resource `name` where appropriate. Avoid colliding filenames/resources from unrelated projects in the same Quadlet directory. Relative bind/env paths resolve beside the installed Quadlet, not beside the original Compose file.

## Capabilities, shared memory and Harbor

`cap_add` and `cap_drop` lists map to `AddCapability` and `DropCapability` with recognized Linux names/ALL and optional CAP_ prefixes. `shm_size` accepts positive numeric bytes or Compose RAM units (case-insensitive b/k/m/g/t/p, optional b/ib suffix); values normalize to explicit bytes. For example, Harbor's `1gb` is `ShmSize=1073741824`. Values must fit the JavaScript safe integer range; fractional unit sizes truncate to bytes. Zero is an error because Podman treats it as unlimited. Capabilities and host execution context still require Linux runtime verification.

Logging is explicitly unsupported. `logging.driver: syslog` produces a specific error explaining Docker daemon forwarding versus Podman/host networking. `logging.options` gets its own diagnostic; the converter never substitutes journald or emits logging PodmanArgs. Other logging drivers/settings also produce errors.

The [official Harbor v2.15.4 fixture and compatibility inventory](tests/fixtures/harbor/v2.15.4/README.md) pin the official installer template, profile inputs and rendered `docker-compose.yml`. HTTPS/Trivy/metrics exercise 11 services. All fields except logging now map, with review diagnostics; the unchanged fixture deliberately blocks exports on 20 logging errors. This does not claim a deployable Harbor migration.

## Unsupported feature behavior

All other fields, including `build`, `healthcheck`, `deploy`, `profiles`, `secrets`, `configs`, `privileged`, `network_mode`, top-level `name`, `include` and `extends`, produce path-specific errors. Unknown nested options also produce errors. **Any error returns no exportable `files` and blocks exports.** Only explicitly marked logging omissions permit a non-exportable preview; other unsupported semantics suppress it. Unsupported configuration is never silently dropped. Warnings require review; info explains metadata handling.

Compose `$VAR`/`${VAR}` interpolation and `.env` resolution are unsupported: provide concrete values first. Compose `$$` becomes a literal dollar; literal `%` and `$` are escaped for systemd. Multiline/control-character values, unsafe names and ambiguous forms are rejected. Limits: 1 MB of text, 1000 services, 100 nesting levels, 50,000 parsed values, bounded YAML alias expansion.

Mappings follow the [Podman Quadlet reference](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html) and [Compose service reference](https://docs.docker.com/reference/compose-file/services/). Units target Linux with systemd, cgroup v2 and Quadlet-capable Podman. Compatibility with your installed Podman version needs runtime verification.

## Using generated units

For rootless Linux, place **all** generated files together in `~/.config/containers/systemd/`. Supply referenced bind mounts/env files at the reviewed host paths, then:

```sh
systemctl --user daemon-reload
systemctl --user start web.service
systemctl --user status web.service
```

The generator applies `[Install]`/`WantedBy=default.target`; do not use `systemctl enable` for generated transient services. User services normally start with the user session; boot without login requires host-side lingering configuration. Review rootful deployments/startup policy separately. Use the installed `podman-system-generator --user --dryrun` on the Linux host to diagnose generator compatibility (see Podman reference for paths).

## Privacy

**No uploads. Your Compose file stays in your browser.** Parsing, conversion, diagnostics, reading, copying, downloads and ZIP creation run locally. There is no backend API, database, analytics, telemetry, upload, remote font or CDN dependency. Input lives in page memory and is not saved to browser storage. Only explicit theme/language preferences are stored locally; translations are bundled with the app. After initial load, conversion/ZIP export require no network request. The GitHub link visits GitHub only when clicked. Initial loading uses the static host; this is not a service-worker/PWA offline-install feature.

## GitHub Pages deployment

- `ci.yml`: install from lockfile, test and build on PRs/feature-branch pushes.
- `pages.yml`: same checks on main pushes/manual dispatch, upload `apps/web/dist`, deploy **only main** with GitHub's Pages environment and OIDC.
- Intended domain **quadlet.chiha.dev** is in `apps/web/public/CNAME`, copied into the build. Root-relative Vite assets target this custom domain.
- After merging, select **Settings → Pages → Build and deployment → Source: GitHub Actions**. Set custom domain `quadlet.chiha.dev`, configure required DNS externally, and enable HTTPS when available. Repository work does not change DNS/Pages account settings.
- For a project-site URL without the custom domain, set Vite `base` to `/compose2quadlet/` before building. Current root base is intentional.

## Runtime validation

`npm test` stays fast and does not require Podman. `npm run test:quadlet` is a separate Linux-only integration command; it builds core and runs Node tests against installed Podman/systemd packages. Missing packages/generator paths fail with an actionable error. Generator discovery reads installed RPM or Debian Podman package manifests; `QUADLET_GENERATOR` may point to a custom installed generator.

CI covers the current and previous supported Fedora stable releases configured in **[tests/integration/compatibility.json](tests/integration/compatibility.json)**. That file is the only release list; the workflow reads it into an independent matrix with `fail-fast: false`. Fedora-specific RPM/bootstrap logic stays in `fedora-ci.sh`; generator discovery and assertions are shared and distribution-independent.

| Platform | Podman / systemd | Validation |
|----------|------------------|------------|
| Each configured Fedora release | Latest available packages from that release's official release + updates repositories; no exact package pin | Real Quadlet generator, emitted service files and focused arguments |

Each job creates a userspace from signed Fedora RPM packages on the Ubuntu runner. It uses neither an OCI environment image nor privileged containers, boots no systemd, starts/pulls no workload, and requires network only for dependency/package installation and repository availability checks. The chroot mounts read-only `/proc` for the installed tools; it does not run a service manager. Pass an explicit `FEDORA_RELEASE` to `bash tests/integration/fedora-ci.sh` on a suitable Linux runner with Node, sudo and `RUNNER_TEMP`; invalid values or unavailable repositories fail before installation.

CI logs and artifacts are the source of truth for **exact tested versions**, which change with repository updates. Each `quadlet-fedora-<release>-output` artifact includes `metadata.json` containing Fedora release, `podman --version`, Podman RPM, `systemd --version`, systemd RPM, detected generator path and commit SHA, together with generator logs and emitted units. Fedora RPM identity comes from querying the installed root's RPM database, rather than assuming a version from the target release.

Compatibility runs on PRs/feature-branch pushes, weekly (Monday 03:17 UTC), and via **workflow_dispatch**. Scheduled/manual runs execute the same matrix without repeating normal browser checks. They use the selected commit's configuration; GitHub scheduled runs use the default branch after merge. No dynamic release scraping occurs in CI.

**Maintaining targets:** after each Fedora stable general availability announcement, review the [official releases](https://docs.fedoraproject.org/en-US/releases/) and [lifecycle](https://docs.fedoraproject.org/en-US/releases/lifecycle/) information and verify both release/updates `repodata/repomd.xml` endpoints. Update only `compatibility.json` (`fedora`, `reviewedAt`, evidence `sources`) to the current and previous supported stable releases, before the oldest target reaches EOL. Run the matrix and inspect every metadata/report artifact before merging the update. Weekly failures may indicate a package regression, repository outage or a target needing retirement; do not mask them by restoring an old Podman package pin.

Each nginx/stack/Harbor test writes Quadlets to a fresh temporary directory and runs `QUADLET_UNIT_DIRS=<dir> <detected-generator> --user --dryrun`. It checks the emitted service set, then invokes the generator in ordinary output mode into another temporary directory to verify actual `.service` files and focused Podman arguments/dependencies. Nothing invokes those service commands. Exit failures, missing/partial unit output, and an intentionally invalid Quadlet are tested. Reports are collected even when an assertion fails.

Harbor validation removes logging only from an in-memory **test-only** copy: 11 container units plus one network unit. The same assertions also validate production preview files from the unchanged input, and compare their understood directives to that test-only equivalent. The original fixture stays unchanged and exports remain blocked on all 20 syslog driver/options errors. Migration readiness exposes every original path, service and category in EN/JP. Passing generator checks does not make the preview exportable or Harbor deployable.

This validates generator syntax and emitted arguments for the configured Fedora/Podman environment, not Harbor deployability, image availability, application readiness, syslog migration, or compatibility with all Podman versions. Linux bind paths, credentials/config files, systemd runtime behavior and the separate Harbor logging migration still require real deployment testing.

## Next development step

Add a separate distribution bootstrap (a supported Ubuntu LTS is a candidate) while reusing the generator assertions. Linux deployment/readiness tests, Harbor's logging migration, health checks, network attachment options and richer commands/mounts remain separate work.

## License

Apache-2.0; see [LICENSE](LICENSE).
