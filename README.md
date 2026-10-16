# QuadletLens

A browser-local migration analyzer for Docker Compose to Podman Quadlet.

[Open QuadletLens](https://quadletlens.chiha.dev/) · [GitHub](https://github.com/chihaaah/QuadletLens)

## Why QuadletLens?

Moving a Compose application to Quadlet involves compatibility checks, changed lifecycle semantics and manual migration work. QuadletLens makes those differences visible before you export units. Unsupported settings produce path-specific findings, and blocking issues prevent incomplete exports.

This is a migration review tool. It does not deploy workloads, replace Docker Compose or guarantee that an application will run correctly.

## Features

- Browser-local YAML parsing, analysis, file reading and ZIP creation.
- Structured migration findings with source paths, categories and remediation guidance.
- Service-level readiness and explicit document-wide blocking issues.
- Safe, non-exportable previews for understood logging omissions.
- Podman target awareness backed by documented directive requirements.
- Real Quadlet generator validation in the Fedora CI matrix.
- English/Japanese interface, light/dark themes and keyboard-accessible controls.
- Deterministic `.container`, `.network` and `.volume` output.

## Live demo / Harbor example

[Open the tool](https://quadletlens.chiha.dev/) and open the [official Harbor fixture](tests/fixtures/harbor/v2.15.4/docker-compose.yml). The pinned HTTPS/Trivy/metrics example produces:

- 11 services and 1 network.
- 20 logging blockers across 10 services.
- 12 preview files.
- 0 exportable files.

**This is not a deployable Harbor migration.** Previews show supported mappings while preserving explicit logging blockers. Passing generator checks does not resolve Docker syslog semantics or validate Harbor at runtime. See the [fixture provenance and compatibility inventory](tests/fixtures/harbor/v2.15.4/README.md).

## How it works

```text
Compose -> Analyze -> Preview -> Safety Gate -> Export
```

Paste YAML or open/drop one `.yml`/`.yaml` file, select **Convert**, and review findings and generated files. Copy, Download and ZIP are available only when the whole document passes the export gate. Editing input or the Podman target disables exports until reanalysis.

Only explicitly understood logging omissions allow a blocked preview. Invalid YAML, unresolved interpolation, invalid values, unknown settings and insufficient Podman targets suppress the entire preview. Warnings still require human review.

The UI-independent core exposes `analyzeCompose()` and the compatible `convertCompose()` entry point through `@quadletlens/core`. See [analysis API, architecture and installation guidance](docs/MIGRATION.md).

## Supported Compose features

| Compose settings | Support |
| --- | --- |
| `services`, `image`, `container_name` | Container units and validated names; literal images required. |
| `ports` | Short syntax, matching ranges, IPv4/IPv6 and TCP/UDP; bounded long syntax. |
| `environment`, `env_file` | Literal values and referenced environment files; no host inheritance. |
| `volumes`, top-level volumes | Declared named volumes and Linux bind paths; basic read-only/SELinux options. |
| `networks`, top-level networks | Shared default or declared bridge/external networks and service-name aliases. |
| `command`, `entrypoint` | Exec arrays and simple strings, with explicit ambiguity checks. |
| `user`, `working_dir` | Container user/group and absolute Linux working directory. |
| `restart`, `depends_on` | Limited systemd restart/ordering mappings with semantic warnings. |
| `cap_add`, `cap_drop`, `shm_size` | Validated capabilities and positive shared-memory sizes. |
| `version`, `x-*`, YAML anchors/merges | Metadata diagnostics and bounded YAML expansion. |

Consult the [complete supported syntax and semantic boundaries](docs/COMPOSE-SUPPORT.md) before migration. Managed resource names differ from Compose project names; relative bind/environment paths resolve beside installed Quadlets.

## Known limitations

- Unsupported Compose fields and nested options produce errors. These include `build`, `healthcheck`, `deploy`, `profiles`, `secrets`, `configs`, `privileged`, `network_mode`, `include` and `extends`.
- Logging is unsupported. Docker `syslog` and logging options have explicit blockers; no automatic journald substitution or `PodmanArgs` workaround is generated.
- `$VAR` / `${VAR}` interpolation and `.env` resolution are unsupported. Supply concrete values; `$$` represents a literal dollar.
- Referenced environment/config files are never read or packaged. `env_file` creates references only; Compose `configs` is unsupported. Supply and review required host files separately.
- Generator validation checks syntax and emitted arguments. Runtime behavior, application readiness, image availability, Linux permissions and host configuration remain unvalidated.

## Local development

Requirements: Git, Node.js **22.12+** (Node 24 LTS recommended) and npm. Podman is not needed for the website or unit tests.

```sh
git clone https://github.com/chihaaah/QuadletLens.git
cd QuadletLens
npm ci
npm run dev
```

Open the localhost URL printed by Vite, normally `http://127.0.0.1:5173`.

```sh
npm test
npm run test:watch
npm run typecheck
npm run build
npm run preview --workspace @quadletlens/web
```

The workspaces are `@quadletlens/core` and `@quadletlens/web`. Serve `apps/web/dist` on any static host.

GitHub Actions [Pages deployment](.github/workflows/pages.yml) builds and deploys main using OIDC. `apps/web/public/CNAME` contains `quadletlens.chiha.dev`; production uses root-relative assets with no project-relative Vite base. DNS and account settings are managed separately by the maintainer.

## Runtime compatibility

The [Fedora matrix](tests/integration/compatibility.json) is the source of truth for current CI targets. Each job installs that release's available Podman/systemd packages and runs the real generator against nginx, stack and Harbor cases, plus invalid input. Exact tested versions and generator output are recorded in each run's logs and artifacts; they are not permanent compatibility promises.

Use `npm run test:quadlet` on an appropriately provisioned Linux host. Optional target Podman versions gate verified directive baselines; unspecified targets and unknown runtime requirements need host verification. See [runtime validation and matrix maintenance](docs/RUNTIME-VALIDATION.md) and [capability evidence](docs/CAPABILITIES.md).

## Privacy

Compose input stays in browser memory. Parsing, analysis, previews, local file reading, copying, downloads and ZIP creation run locally. There is no backend, upload, analytics, telemetry, remote font or CDN dependency. After the static app loads, conversion and export need no network requests. Clicking GitHub navigates to GitHub. The app does not provide service-worker/PWA offline installation.

Only explicit theme/language preferences are stored in `quadletlens.theme` and `quadletlens.language`. Valid new values take priority; valid legacy `compose2quadlet.theme` / `compose2quadlet.language` values are read as a fallback **on the same origin**. Future selections write only new keys. The pre-paint script and React use the same rules, and blocked storage falls back to browser defaults.

Preferences cannot automatically migrate from `quadlet.chiha.dev` to `quadletlens.chiha.dev` because localStorage is origin-scoped. There is no cross-origin data transfer. Compose input and secrets are never persisted to browser storage.

## Development roadmap

- Add another distribution bootstrap while reusing generator assertions.
- Add Linux deployment and application-readiness verification.
- Investigate explicit Harbor logging migration guidance.
- Extend supported health checks, network attachments, commands and mounts with tests and clear semantic boundaries.

## Contributing

Read [AGENTS.md](AGENTS.md) for project rules and [DESIGN.md](DESIGN.md) for the restrained developer-tool interface. Work on a feature branch, preserve export safety, and add meaningful tests for mapping or validation changes. Run tests, typecheck and build before submitting a PR.

## License

Apache-2.0; see [LICENSE](LICENSE).
