# Podman target capability evidence

The small registry in `packages/core/src/capabilities.ts` gates only implemented directives with confirmed upstream release baselines. Evidence was reviewed on 2026-10-15 using official Podman tagged documentation and generator source, comparing the introducing release with the preceding minor release. No third-party converter matrix or implementation is used.

| Directive | Earliest upstream release baseline | Introducing source | Preceding release without directive |
|---|---|---|---|
| WorkingDir | 4.6.0 | [generator](https://github.com/containers/podman/blob/v4.6.0/pkg/systemd/quadlet/quadlet.go) | [4.5.0](https://github.com/containers/podman/blob/v4.5.0/pkg/systemd/quadlet/quadlet.go) |
| ShmSize | 4.7.0 | [generator](https://github.com/containers/podman/blob/v4.7.0/pkg/systemd/quadlet/quadlet.go) | [4.6.0](https://github.com/containers/podman/blob/v4.6.0/pkg/systemd/quadlet/quadlet.go) |
| Entrypoint | 5.0.0 | [generator](https://github.com/containers/podman/blob/v5.0.0/pkg/systemd/quadlet/quadlet.go) | [4.9.0](https://github.com/containers/podman/blob/v4.9.0/pkg/systemd/quadlet/quadlet.go) |
| NetworkAlias | 5.2.0 | [documentation](https://github.com/containers/podman/blob/v5.2.0/docs/source/markdown/podman-systemd.unit.5.md) | [5.1.0](https://github.com/containers/podman/blob/v5.1.0/docs/source/markdown/podman-systemd.unit.5.md) |

These are upstream directive-presence gates. They do not certify every directive value, distro backport, patch release, systemd behavior or successful deployment. `NetworkAlias` is emitted for service discovery even with an implicit default network, so a target older than its baseline blocks an otherwise simple service. Required directives are never silently removed to accommodate an old target.

All other implemented directives and full-unit behavior remain subject to runtime verification; their minimum versions are deliberately unspecified. An unspecified target imposes no numeric assumption. A valid newer target does not replace runtime verification. Malformed targets block export and preview; prerelease/build/distro suffixes are intentionally not interpreted as upstream release versions.

The Fedora compatibility matrix exercises current repository versions, including these mappings, using the real installed generator. Integration tests analyze exportable fixtures against the **actual** Podman version reported by the environment. Harbor original previews and test-only logging-stripped output are both generator-checked. Historical minima above have source evidence and unit boundary checks, not a historical binary test matrix. Exact currently tested versions are in CI metadata artifacts.

To add a gate: confirm official introducing/preceding sources, document the implemented value semantics, add boundary tests and include the mapping in real-generator assertions. If evidence is uncertain, retain runtime verification instead of guessing a minimum.
