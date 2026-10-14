# Compose2Quadlet

Convert Docker Compose YAML into Podman Quadlet `.container`, `.network`, and `.volume` files entirely in your browser.

**Status:** first working MVP with a conservative Compose subset. Review diagnostics and validate units on your Linux/Podman host before installing them.

## Local development

Requirements: Git and Node.js **22.12+** (Node 24 LTS recommended), with npm. Podman is not needed to run the website.

```sh
git clone https://github.com/chihaaah/compose2quadlet.git
cd compose2quadlet
npm install
npm run dev
```

Open Vite's localhost URL (normally `http://127.0.0.1:5173`). Paste YAML or open/drop one `.yml`/`.yaml` file, select **Convert**, review diagnostics, then select a generated file to copy/download it or download everything as ZIP. Editing input disables exports until the next conversion.

```sh
npm test                # Converter and ZIP tests
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

## Unsupported feature behavior

All other fields, including `build`, `healthcheck`, `deploy`, `profiles`, `secrets`, `configs`, `privileged`, `network_mode`, top-level `name`, `include` and `extends`, produce path-specific errors. Unknown nested options also produce errors. **Any error returns no files and blocks exports.** Unsupported configuration is never silently dropped. Warnings require review; info explains metadata handling.

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

**No uploads. Your Compose file stays in your browser.** Parsing, conversion, diagnostics, reading, copying, downloads and ZIP creation run locally. There is no backend API, database, analytics, telemetry, upload, remote font or CDN dependency. Input lives in page memory and is not saved to browser storage. After initial load, conversion/ZIP export require no network request. The Source link visits GitHub only when clicked. Initial loading uses the static host; this is not a service-worker/PWA offline-install feature.

## GitHub Pages deployment

- `ci.yml`: install from lockfile, test and build on PRs/feature-branch pushes.
- `pages.yml`: same checks on main pushes/manual dispatch, upload `apps/web/dist`, deploy **only main** with GitHub's Pages environment and OIDC.
- Intended domain **quadlet.chiha.dev** is in `apps/web/public/CNAME`, copied into the build. Root-relative Vite assets target this custom domain.
- After merging, select **Settings → Pages → Build and deployment → Source: GitHub Actions**. Set custom domain `quadlet.chiha.dev`, configure required DNS externally, and enable HTTPS when available. Repository work does not change DNS/Pages account settings.
- For a project-site URL without the custom domain, set Vite `base` to `/compose2quadlet/` before building. Current root base is intentional.

## Next development step

Add Linux integration tests against the real Quadlet generator and supported Podman versions, then expand health checks, network attachment options and richer commands/mounts with diagnostics and fixtures.

## License

Apache-2.0; see [LICENSE](LICENSE).
