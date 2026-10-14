# Official Harbor Compose fixture

This is a **rendered deployment Compose file from the official Harbor installer template**, not a hand-written approximation or the repository's minimal integration-test Compose file. Harbor generates `docker-compose.yml` during `prepare`; its repository ships Jinja source rather than a single pre-generated deployment file.

- Release: **v2.15.4**.
- Pinned commit: `0a6bf30d54e779962ad5b862fc67e3e9f6b010d8`.
- Source: [official docker-compose.yml.jinja](https://github.com/goharbor/harbor/blob/0a6bf30d54e779962ad5b862fc67e3e9f6b010d8/make/photon/prepare/templates/docker_compose/docker-compose.yml.jinja).
- Official generation: [prepare_docker_compose](https://github.com/goharbor/harbor/blob/0a6bf30d54e779962ad5b862fc67e3e9f6b010d8/make/photon/prepare/utils/docker_compose.py).
- Upstream license: Apache-2.0, [Harbor LICENSE](https://github.com/goharbor/harbor/blob/0a6bf30d54e779962ad5b862fc67e3e9f6b010d8/LICENSE). Vendored template preserved unchanged.
- Template SHA-256: `1534979060530a7927a29e4807aac32e08900cff6f00e895b4282751e9a5642e`.
- Rendered YAML SHA-256: `03f011feb4490c5ea998fd8675a757e24a4c78ae89c501e0e49cf73cd6a99122`.

`profile.json` records all rendering inputs: HTTPS (80/443), Trivy and metrics (9090), internal database/Redis, `/data` and `/var/log/harbor`. Internal TLS and optional GCS/UAA files are off. All 11 services are expanded: log, registry, registryctl, postgresql, core, portal, jobservice, redis, proxy, trivy-adapter, exporter. Referenced configuration/env/certificate files are not bundled; fixture paths contain no credentials or private keys.

## Reproduce

Only regeneration needs Python and `Jinja2==3.1.6`. In an isolated environment with that package available:

```sh
python tests/fixtures/harbor/v2.15.4/regenerate.py
```

The script checks the original template hash and uses Jinja's sandbox with StrictUndefined. Whitespace settings (`trim_blocks`, `lstrip_blocks`, trailing-newline behavior and disabled autoescaping for `.jinja`) match the [official Jinja helper](https://github.com/goharbor/harbor/blob/0a6bf30d54e779962ad5b862fc67e3e9f6b010d8/make/photon/prepare/utils/jinja.py). Rendering makes no network calls and does not launch the installer or Harbor. Normal npm tests/build use committed YAML; Python/Jinja are not project dependencies. `.gitattributes` preserves LF bytes on Windows/Linux. Do not reformat the template or generated YAML.

## Conversion inventory

| Feature in this fixture               | Status / remaining work                                                                                                                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services`, `image`, `container_name` | Supported: 11 services, explicit Harbor image tags/names.                                                                                                                                                 |
| `cap_add`, `cap_drop`                 | Supported: CHOWN, DAC_OVERRIDE, SETGID, SETUID, NET_BIND_SERVICE and ALL map to AddCapability/DropCapability. Validate names, normalize case/optional CAP_ prefix.                                        |
| `shm_size: '1gb'`                     | Supported: postgresql emits `ShmSize=1073741824` bytes. Compose RAM units use base 1024. Reject zero rather than turning it into Podman's unlimited setting.                                              |
| `ports`                               | Supported: loopback syslog receiver, HTTP/HTTPS/metrics short forms. Review host availability and rootless low-port setup.                                                                                |
| `env_file`                            | Supported references. Supply `common/config/*/env` files on the target host and review env-file semantics.                                                                                                |
| `volumes`                             | Supported Linux short binds (including SELinux `:z`) and long `type/source/target` binds. Review host data/config/cert paths, ownership/permissions. Relative paths resolve beside the installed Quadlet. |
| `networks`                            | Supported lists and `{harbor: null}` attachments, top-level `external: false`. Resource names differ from Compose project-scoped names.                                                                   |
| `restart: always`                     | Supported via systemd, with existing lifecycle/start-limit review diagnostic.                                                                                                                             |
| `depends_on`                          | Supported Requires/After startup ordering; review application readiness, failure/stop behavior and boot sequencing.                                                                                       |
| `logging.driver: syslog`              | **Error at each `.logging.driver`**. Docker daemon forwarding, endpoint reachability and Podman logging differ. No automatic LogDriver, LogOpt, PodmanArgs or journald substitution.                      |
| `logging.options`                     | **Error at each `.logging.options`**. Preserve `syslog-address: tcp://localhost:1514`, transport and per-service tags in a reviewed logging migration.                                                    |

The unmodified fixture produces **20 errors** (driver/options for 10 services) and **76 review warnings**, returning no files. The log collector itself has no logging override. Tests remove logging **only in an in-memory copy** to isolate implemented mappings: that copy produces 11 containers plus `network-harbor.network` without conversion errors. This is a compatibility test, not an installable Harbor migration.

Other template branches (internal TLS, GCS keyfile, UAA CA) introduce long bind mounts that are structurally supported but not rendered/exercised by this profile. External database/Redis and HTTP-only profiles are not fixture-tested; audit separately before claiming all Harbor deployments work.

Next: design/test Docker-daemon-to-Podman syslog migration on Linux. Verify collector networking (host loopback vs container namespace), transport/tag handling, bind paths, capabilities, shared memory, dependencies and Harbor readiness against real Quadlet/systemd. Never make the source fixture pass by deleting logging or silently switching drivers.
