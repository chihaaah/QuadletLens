import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { convertCompose } from "../packages/core/src/index";

const directory = new URL("./fixtures/harbor/v2.15.4/", import.meta.url);
const source = readFileSync(new URL("docker-compose.yml", directory), "utf8");
const simple = (settings: Record<string, unknown>) =>
  convertCompose(
    stringify({ services: { web: { image: "nginx", ...settings } } }),
  );
const content = (settings: Record<string, unknown>) =>
  simple(settings).files.find((f) => f.filename === "web.container")?.content;

describe("Harbor compatibility", () => {
  it("pins the official upstream template and its rendered deployment fixture", () => {
    const digest = (name: string) =>
      createHash("sha256")
        .update(readFileSync(new URL(name, directory)))
        .digest("hex");
    expect(digest("docker-compose.yml.jinja")).toBe(
      "1534979060530a7927a29e4807aac32e08900cff6f00e895b4282751e9a5642e",
    );
    expect(digest("docker-compose.yml")).toBe(
      "03f011feb4490c5ea998fd8675a757e24a4c78ae89c501e0e49cf73cd6a99122",
    );
    expect(source).not.toMatch(/\{%|\{\{/);
  });
  it("reports syslog explicitly on every affected Harbor service and exports nothing", () => {
    const result = convertCompose(source);
    expect(result.files).toEqual([]);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    const services = [
      "core",
      "exporter",
      "jobservice",
      "portal",
      "postgresql",
      "proxy",
      "redis",
      "registry",
      "registryctl",
      "trivy-adapter",
    ];
    expect(errors.map((d) => d.path)).toEqual(
      services.flatMap((name) => [
        `$.services.${name}.logging.driver`,
        `$.services.${name}.logging.options`,
      ]),
    );
    for (const error of errors.filter((d) => d.path.endsWith(".driver"))) {
      expect(error.code).toBe("unsupported");
      expect(error.message).toContain("Docker syslog");
      expect(error.message).toContain("No LogDriver or PodmanArgs");
    }
  });
  it("isolates logging in a test copy to demonstrate all other fixture fields map", () => {
    const document = parse(source) as {
      services: Record<string, Record<string, unknown>>;
    };
    for (const service of Object.values(document.services))
      delete service.logging;
    const result = convertCompose(stringify(document));
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual(
      [],
    );
    expect(result.files).toHaveLength(12);
    const database = result.files.find(
      (f) => f.filename === "postgresql.container",
    )!.content;
    expect(database).toContain("DropCapability=ALL");
    expect(database).toContain("AddCapability=DAC_OVERRIDE");
    expect(database).toContain("ShmSize=1073741824");
    for (const file of result.files)
      expect(file.content).not.toMatch(/LogDriver=|LogOpt=|PodmanArgs=/);
    // The source fixture is never rewritten/simplified to make this test pass.
    expect(readFileSync(new URL("docker-compose.yml", directory), "utf8")).toBe(
      source,
    );
  });
  it("maps drop ALL and explicit additions together", () => {
    const output = content({
      cap_drop: ["ALL"],
      cap_add: ["CHOWN", "CAP_SETUID", "net_bind_service"],
    });
    expect(output).toContain("DropCapability=ALL");
    expect(output).toContain(
      "AddCapability=CHOWN\nAddCapability=SETUID\nAddCapability=NET_BIND_SERVICE",
    );
  });
  it("accepts empty capability lists without changing defaults", () => {
    expect(content({ cap_add: [], cap_drop: [] })).not.toMatch(
      /(?:Add|Drop)Capability=/,
    );
  });
  it.each(["cap_add", "cap_drop"])(
    "validates %s container and entries",
    (key) => {
      for (const value of [
        "ALL",
        null,
        {},
        ["NOT_A_CAPABILITY"],
        ["--privileged"],
        ["CHOWN SETUID"],
        [1],
        ["CHOWN\nImage=evil"],
      ]) {
        const result = simple({ [key]: value });
        expect(result.files).toEqual([]);
        expect(
          result.diagnostics.some(
            (d) =>
              d.severity === "error" &&
              d.path.startsWith(`$.services.web.${key}`),
          ),
        ).toBe(true);
      }
    },
  );
  it.each([
    ["1gb", "1073741824"],
    ["1GB", "1073741824"],
    ["512mb", "536870912"],
    ["1.5g", "1610612736"],
    ["64MiB", "67108864"],
    ["1 kb", "1024"],
    ["1024", "1024"],
    [1024, "1024"],
  ])("normalizes Compose shm_size %s to explicit bytes", (value, bytes) => {
    expect(content({ shm_size: value })).toContain(`ShmSize=${bytes}`);
  });
  it.each([
    -1,
    1.5,
    false,
    null,
    {},
    "-1g",
    "not-a-size",
    "1eb",
    "1bb",
    "1g\nImage=evil",
    "999999999999999999999999g",
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects invalid/unsupported shm_size %s", (value) => {
    const result = simple({ shm_size: value });
    expect(result.files).toEqual([]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "invalid-value",
        path: "$.services.web.shm_size",
      }),
    );
  });
  it.each([0, "0b", "0.5b"])(
    "does not turn zero-sized shared memory %s into Podman unlimited memory",
    (value) => {
      const result = simple({ shm_size: value });
      expect(result.files).toEqual([]);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          severity: "error",
          code: "unsupported",
          path: "$.services.web.shm_size",
          message: expect.stringContaining("unlimited"),
        }),
      );
    },
  );
  it("diagnoses syslog even when mixed with supported fields; never substitutes journald", () => {
    const result = simple({
      cap_add: ["CHOWN"],
      cap_drop: ["ALL"],
      shm_size: "1gb",
      logging: {
        driver: "syslog",
        options: { "syslog-address": "tcp://localhost:1514", tag: "web" },
      },
    });
    expect(result.files).toEqual([]);
    expect(
      result.diagnostics.some(
        (d) =>
          d.path === "$.services.web.logging.driver" &&
          d.code === "unsupported",
      ),
    ).toBe(true);
    expect(
      result.diagnostics.some(
        (d) => d.path === "$.services.web.logging.options",
      ),
    ).toBe(true);
  });
  it("does not silently accept other or malformed logging settings", () => {
    for (const logging of [
      null,
      "syslog",
      {},
      { driver: "journald" },
      { options: {} },
      { driver: "syslog", unknown: true },
    ]) {
      const result = simple({ logging });
      expect(result.files).toEqual([]);
      expect(
        result.diagnostics.some(
          (d) =>
            d.severity === "error" &&
            d.path.startsWith("$.services.web.logging"),
        ),
      ).toBe(true);
    }
  });
});
