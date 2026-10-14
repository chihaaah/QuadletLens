import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { convertCompose } from "../packages/core/src/index";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.yaml`, import.meta.url), "utf8");
const convert = (service: Record<string, unknown>, extra = {}) =>
  convertCompose(
    stringify({
      services: { web: { image: "nginx:latest", ...service } },
      ...extra,
    }),
  );
const content = (
  result: ReturnType<typeof convertCompose>,
  filename = "web.container",
) => result.files.find((f) => f.filename === filename)?.content ?? "";
const fails = (service: Record<string, unknown>, path: string, extra = {}) => {
  const result = convert(service, extra);
  expect(result.files).toEqual([]);
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ severity: "error", path }),
  );
};

describe("Compose conversion", () => {
  it("generates a usable nginx container and default shared network", () => {
    const result = convertCompose(fixture("nginx"));
    expect(content(result)).toContain(
      "[Container]\nImage=nginx:latest\nPublishPort=8080:80",
    );
    expect(content(result)).toContain("Network=network-default.network");
    expect(content(result)).toContain("NetworkAlias=web");
    expect(content(result)).toContain("[Install]\nWantedBy=default.target");
    expect(content(result, "network-default.network")).toContain("[Network]");
    expect(result.diagnostics.every((d) => d.severity !== "error")).toBe(true);
  });
  it("maps the supported stack with dependencies and review diagnostics", () => {
    const result = convertCompose(fixture("stack"));
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual(
      [],
    );
    expect(result.files.map((f) => f.filename)).toEqual([
      "app.container",
      "database.container",
      "network-front.network",
      "volume-data.volume",
    ]);
    const app = content(result, "app.container");
    for (const line of [
      "ContainerName=demo-app",
      "PublishPort=127.0.0.1:8080:80/tcp",
      'Environment="GREETING=hello world"',
      'Environment="EMPTY="',
      'EnvironmentFile="./app.env"',
      "Volume=volume-data.volume:/data:ro",
      "Volume=./config:/config:ro",
      "Network=network-front.network",
      "User=1000:1000",
      "WorkingDir=/data",
      'Exec="-c" "echo hello"',
      'Entrypoint=["/bin/sh"]',
      "Restart=on-failure",
      "Requires=database.service",
      "After=database.service",
    ])
      expect(app).toContain(line);
    for (const path of [
      "$.services.app.env_file[0]",
      "$.services.app.volumes[1]",
      "$.services.app.restart",
      "$.services.app.depends_on",
    ])
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ severity: "warning", path }),
      );
  });
  it("is deterministic across mapping order and repeated calls", () => {
    const a = convertCompose(
      "services:\n  b:\n    image: alpine\n    environment: {Z: last, A: first}\n  a:\n    image: nginx\n",
    );
    const b = convertCompose(
      "services:\n  a:\n    image: nginx\n  b:\n    environment: {A: first, Z: last}\n    image: alpine\n",
    );
    expect(a).toEqual(b);
    expect(convertCompose(fixture("stack"))).toEqual(
      convertCompose(fixture("stack")),
    );
  });
  it.each([
    "build",
    "healthcheck",
    "deploy",
    "privileged",
    "network_mode",
    "secrets",
    "configs",
    "profiles",
  ])("reports unsupported %s without exporting partial files", (key) =>
    fails({ [key]: {} }, `$.services.web.${key}`),
  );
  it("reports unsupported top-level and nested fields", () => {
    fails({}, "$.secrets", { secrets: { password: {} } });
    fails({}, "$.networks.default.ipam", {
      networks: { default: { ipam: {} } },
    });
    fails(
      { ports: [{ target: 80, name: "http" }] },
      "$.services.web.ports[0].name",
    );
    fails(
      {
        volumes: [
          {
            type: "bind",
            source: "./data",
            target: "/data",
            bind: { propagation: "shared" },
          },
        ],
      },
      "$.services.web.volumes[0].bind",
    );
    fails(
      { networks: { default: { aliases: ["http"] } } },
      "$.services.web.networks.default",
    );
  });
  it.each([
    "services: [",
    "services:\n  web:\n    image: nginx\n    image: alpine",
    "---\nservices: {}\n---\nservices: {}",
    "services: !unsafe {}",
  ])("rejects invalid or ambiguous YAML: %s", (yaml) => {
    const result = convertCompose(yaml);
    expect(result.files).toEqual([]);
    expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
  });
  it.each([
    "",
    "hello",
    "[]",
    "services: {}",
    "services: []",
    "services: {web: null}",
    "services: {web: {}}",
  ])("rejects malformed Compose: %s", (yaml) =>
    expect(convertCompose(yaml).files).toEqual([]),
  );
  it("supports anchors and merges, rejects cyclic aliases", () => {
    const result = convertCompose(
      "x-base: &base\n  image: nginx\nservices:\n  web:\n    <<: *base\n",
    );
    expect(content(result)).toContain("Image=nginx");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "info", code: "extension" }),
    );
    expect(convertCompose("services: &loop {web: *loop}").files).toEqual([]);
  });
  it.each(["${IMAGE}", "$IMAGE", "$$${IMAGE}", "nginx:${TAG:-latest}"])(
    "requires explicit interpolation values for %s",
    (image) => fails({ image }, "$.services.web.image"),
  );
  it("handles escaped dollars and literal percent signs without host substitution", () => {
    const result = convert({
      environment: { VALUE: '100% $$HOME "hello" \\ world' },
      command: ["echo", "$$HOME", "100%", "a b"],
    });
    expect(content(result)).toContain(
      'Environment="VALUE=100%% $$HOME \\"hello\\" \\\\ world"',
    );
    expect(content(result)).toContain('Exec="echo" "$$HOME" "100%%" "a b"');
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual(
      [],
    );
  });
  it("rejects environment inheritance, malformed values and line injection", () => {
    fails({ environment: ["HOST_VALUE"] }, "$.services.web.environment[0]");
    fails(
      { environment: { HOST_VALUE: null } },
      "$.services.web.environment.HOST_VALUE",
    );
    fails(
      { environment: { VALUE: ["a"] } },
      "$.services.web.environment.VALUE",
    );
    fails(
      { environment: { VALUE: "a\n[Service]\nExecStart=evil" } },
      "$.services.web.environment.VALUE",
    );
    fails(
      { environment: { "BAD NAME": "value" } },
      "$.services.web.environment.BAD NAME",
    );
  });
  it("supports list environment and ordered env files", () => {
    const result = convert({
      environment: ["A=1", "EMPTY=", "MORE=a=b"],
      env_file: ["first.env", "/etc/second.env"],
    });
    expect(content(result)).toContain('Environment="MORE=a=b"');
    expect(content(result)).toContain(
      'EnvironmentFile="./first.env"\nEnvironmentFile="/etc/second.env"',
    );
  });
  it("diagnoses long env-file settings instead of reading or dropping them", () =>
    fails(
      { env_file: [{ path: "./env", required: false }] },
      "$.services.web.env_file[0]",
    ));
  it("creates named resources and references external resources without creating them", () => {
    const result = convert(
      { networks: ["front"], volumes: ["data:/data"] },
      {
        networks: { front: { name: "existing-network", external: true } },
        volumes: { data: { name: "existing-volume", external: true } },
      },
    );
    expect(result.files.map((f) => f.filename)).toEqual(["web.container"]);
    expect(content(result)).toContain("Network=existing-network");
    expect(content(result)).toContain("Volume=existing-volume:/data");
    const named = convert(
      {},
      {
        networks: { default: { name: "my-network", driver: "bridge" } },
        volumes: { data: { name: "my-data", driver: "local" } },
      },
    );
    expect(content(named, "network-default.network")).toContain(
      "NetworkName=my-network",
    );
    expect(content(named, "volume-data.volume")).toContain(
      "VolumeName=my-data",
    );
  });
  it("rejects undeclared references and resource drivers", () => {
    fails({ networks: ["missing"] }, "$.services.web.networks");
    fails({ volumes: ["missing:/data"] }, "$.services.web.volumes[0]");
    fails({}, "$.volumes.data.driver", {
      volumes: { data: { driver: "nfs" } },
    });
    fails({}, "$.networks.default.name", {
      networks: { default: { external: true, name: "host" } },
    });
  });
  it("maps long bind and volume mounts", () => {
    const result = convert(
      {
        volumes: [
          {
            type: "bind",
            source: "/srv/config",
            target: "/config",
            read_only: true,
          },
          { type: "volume", source: "data", target: "/data" },
        ],
      },
      { volumes: { data: null } },
    );
    expect(content(result)).toContain("Volume=/srv/config:/config:ro");
    expect(content(result)).toContain("Volume=volume-data.volume:/data");
  });
  it.each(["/data", "C:\\host:/data", "data:/data:cached", "data:relative"])(
    "rejects unsafe or unsupported mount %s",
    (mount) =>
      fails({ volumes: [mount] }, "$.services.web.volumes[0]", {
        volumes: { data: {} },
      }),
  );
  it.each([
    "8080:80",
    "127.0.0.1:8080:80/tcp",
    "[::1]:8080:80",
    "8000-8002:80-82/udp",
    "80",
  ])("supports port %s", (port) =>
    expect(content(convert({ ports: [port] }))).toContain(
      `PublishPort=${port}`,
    ),
  );
  it.each([
    "0:80",
    "70000:80",
    "81-80:80",
    "8000-8002:80",
    "80/sctp",
    "not-a-port",
  ])("rejects invalid port %s", (port) =>
    fails({ ports: [port] }, "$.services.web.ports[0]"),
  );
  it("rejects ingress publishing and supports IPv6 long ports", () => {
    fails(
      { ports: [{ target: 80, published: 8080, mode: "ingress" }] },
      "$.services.web.ports[0].mode",
    );
    expect(
      content(
        convert({ ports: [{ target: 80, published: 8080, host_ip: "::1" }] }),
      ),
    ).toContain("PublishPort=[::1]:8080:80");
  });
  it.each(["no", "always", "on-failure", "unless-stopped"])(
    "maps restart %s",
    (restart) =>
      expect(content(convert({ restart }))).toContain(
        `Restart=${restart === "unless-stopped" ? "always" : restart}`,
      ),
  );
  it("rejects bounded restart attempts and bool no", () => {
    fails({ restart: "on-failure:3" }, "$.services.web.restart");
    fails({ restart: false }, "$.services.web.restart");
  });
  it("supports simple string commands and flags ambiguous shell quoting", () => {
    expect(content(convert({ command: "echo hello" }))).toContain(
      'Exec="echo" "hello"',
    );
    fails({ command: 'sh -c "echo hello"' }, "$.services.web.command");
    fails({ command: [] }, "$.services.web.command");
    fails({ command: ["echo", ""] }, "$.services.web.command");
    fails({ entrypoint: ["/bin/sh"] }, "$.services.web.entrypoint");
    expect(content(convert({ entrypoint: [], command: ["echo"] }))).toContain(
      "Entrypoint=[]",
    );
    expect(content(convert({ command: null, entrypoint: null }))).not.toContain(
      "Exec=",
    );
  });
  it("detects dependency cycles and health conditions", () => {
    const result = convertCompose(
      stringify({
        services: {
          a: { image: "alpine", depends_on: ["b"] },
          b: { image: "alpine", depends_on: ["a"] },
        },
      }),
    );
    expect(result.files).toEqual([]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "dependency-cycle" }),
    );
    fails({ depends_on: ["missing"] }, "$.services.web.depends_on");
    fails(
      { depends_on: { web: { condition: "service_healthy" } } },
      "$.services.web.depends_on.web.condition",
    );
  });
  it("rejects traversal and generated unit collisions", () => {
    expect(
      convertCompose('services: {"../evil": {image: nginx}}').files,
    ).toEqual([]);
    const result = convertCompose(
      "services: {network-default-network: {image: nginx}}",
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "name-collision" }),
    );
    expect(result.files).toEqual([]);
  });
  it("bounds oversized input", () =>
    expect(convertCompose(" ".repeat(1_000_001)).diagnostics[0]?.code).toBe(
      "input-limit",
    ));
  it("rejects IPv4 octets outside the valid range", () =>
    fails({ ports: ["999.0.0.1:8080:80"] }, "$.services.web.ports[0]"));
  it("rejects external network names that Quadlet interprets as modes", () =>
    fails({ networks: ["host"] }, "$.networks.host.name", {
      networks: { host: { external: true } },
    }));
  it("preserves spaces in raw mount paths and quotes env file paths as a single argument", () => {
    const result = convert({
      env_file: "/srv/my config/app.env",
      volumes: ["/srv/my config:/my config:ro"],
    });
    expect(content(result)).toContain(
      'EnvironmentFile="/srv/my config/app.env"',
    );
    expect(content(result)).toContain("Volume=/srv/my config:/my config:ro");
  });
  it("detects collisions between explicit and default container names", () => {
    const result = convertCompose(
      "services:\n  a:\n    image: alpine\n    container_name: systemd-b\n  b:\n    image: alpine\n",
    );
    expect(result.files).toEqual([]);
    expect(result.diagnostics.some((d) => d.code === "name-collision")).toBe(
      true,
    );
  });
  it("rejects raw scalar line continuations and whitespace that Quadlet would trim", () => {
    fails({ working_dir: "/tmp/\\" }, "$.services.web.working_dir");
    fails({ working_dir: "/tmp/ " }, "$.services.web.working_dir");
  });
});
