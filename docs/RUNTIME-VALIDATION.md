# Runtime validation

`npm test` stays fast and does not require Podman. `npm run test:quadlet` is a separate Linux-only integration command; it builds core and runs Node tests against installed Podman/systemd packages. Missing packages/generator paths fail with an actionable error. Generator discovery reads installed RPM or Debian Podman package manifests; `QUADLET_GENERATOR` may point to a custom installed generator.

CI covers the current and previous supported Fedora stable releases configured in **[tests/integration/compatibility.json](../tests/integration/compatibility.json)**. That file is the only release list; the workflow reads it into an independent matrix with `fail-fast: false`. Fedora-specific RPM/bootstrap logic stays in `fedora-ci.sh`; generator discovery and assertions are shared and distribution-independent.

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

