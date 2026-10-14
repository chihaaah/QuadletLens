import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  accessSync,
  constants,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { test } from "node:test";
import { parse, stringify } from "yaml";
import { convertCompose } from "../../packages/core/dist/index.js";
import {
  checkProcess,
  execStart,
  expectedServices,
  parseDryRun,
} from "./generator-harness.mjs";

if (process.platform !== "linux")
  throw new Error(
    "Real Quadlet validation requires Linux with Podman/Quadlet installed. npm test remains platform-independent; use the Fedora CI job for this test.",
  );
const run = (command, args, env = {}) =>
  spawnSync(command, args, {
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
for (const command of ["podman", "systemd"]) {
  const result = run(command, ["--version"]);
  checkProcess(
    result,
    `${command} --version (install Podman and systemd packages)`,
  );
  console.log(result.stdout.trim());
}
function findGenerator() {
  let candidates = [];
  if (process.env.QUADLET_GENERATOR)
    candidates = [process.env.QUADLET_GENERATOR];
  else {
    // Read installed package manifests, including distributions with split Quadlet packages.
    for (const [command, args] of [
      ["rpm", ["-qal"]],
      ["dpkg-query", ["-L", "podman"]],
    ]) {
      const result = run(command, args);
      if (result.status === 0)
        candidates.push(
          ...result.stdout
            .split(/\r?\n/)
            .filter((p) => basename(p) === "podman-system-generator"),
        );
    }
  }
  for (const candidate of [...new Set(candidates)]) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      /* Try next installed path. */
    }
  }
  throw new Error(
    "No executable podman-system-generator found in installed RPM/Podman package manifests. Install the distribution's Quadlet package, or set QUADLET_GENERATOR to its installed executable path.",
  );
}
const generator = findGenerator();
console.log(`Quadlet generator: ${generator}`);
const fixture = (path) =>
  readFileSync(new URL(`../fixtures/${path}`, import.meta.url), "utf8");

function validate(name, files, inspect) {
  const directory = mkdtempSync(join(tmpdir(), "compose2quadlet-"));
  const source = join(directory, "source"),
    output = join(directory, "generated");
  mkdirSync(source);
  mkdirSync(output);
  try {
    for (const file of files)
      writeFileSync(join(source, file.filename), file.content);
    const env = { QUADLET_UNIT_DIRS: source };
    const dryrun = run(generator, ["--user", "--dryrun"], env);
    const expected = expectedServices(files);
    const emitted = parseDryRun(dryrun, expected);
    // Also materialize real service files. This does not start/enable any host service.
    const materialized = run(
      generator,
      ["--user", "--no-kmsg-log", output],
      env,
    );
    checkProcess(materialized, "Quadlet service file generation");
    const names = readdirSync(output)
      .filter((n) => n.endsWith(".service"))
      .sort();
    assert.deepEqual(names, expected);
    const units = new Map(
      names.map((n) => [n, readFileSync(join(output, n), "utf8")]),
    );
    assert.deepEqual([...emitted.keys()].sort(), names);
    inspect(units);
    console.log(
      `${name}: validated ${names.length} service files: ${names.join(", ")}`,
    );
    if (process.env.QUADLET_REPORT_DIR) {
      const report = join(process.env.QUADLET_REPORT_DIR, name);
      mkdirSync(report, { recursive: true });
      writeFileSync(join(report, "dryrun.stdout"), dryrun.stdout);
      writeFileSync(join(report, "dryrun.stderr"), dryrun.stderr);
      writeFileSync(join(report, "generation.stderr"), materialized.stderr);
      for (const [filename, text] of units)
        writeFileSync(join(report, filename), text);
    }
    return { dryrun, materialized };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
function convert(source) {
  const result = convertCompose(source);
  assert.deepEqual(
    result.diagnostics.filter((d) => d.severity === "error"),
    [],
  );
  assert(result.files.length);
  return result.files;
}
const hasArg = (unit, flag, value) =>
  assert.match(execStart(unit), new RegExp(`${flag}(?:=|\\s+)["']?${value}`));

test("nginx emits web.service and a real network service", () => {
  validate("nginx", convert(fixture("nginx.yaml")), (units) => {
    hasArg(units.get("web.service"), "--publish", "8080:80");
    hasArg(units.get("web.service"), "--network", "systemd-network-default");
    assert.match(
      units.get("web.service"),
      /^Requires=.*network-default-network\.service/m,
    );
    assert.match(
      execStart(units.get("network-default-network.service")),
      /network create/,
    );
  });
});
test("stack emits containers, network, volume and dependency/command arguments", () => {
  validate("stack", convert(fixture("stack.yaml")), (units) => {
    const app = units.get("app.service");
    hasArg(app, "--publish", "127.0.0.1:8080:80/tcp");
    hasArg(app, "--network", "systemd-network-front");
    assert.match(
      execStart(app),
      /(?:-v|--volume)(?:=|\s+)systemd-volume-data:\/data:ro/,
    );
    assert.match(execStart(app), /\/config:ro/);
    assert.match(app, /^Requires=.*database\.service/m);
    assert.match(app, /^After=.*database\.service/m);
    assert.match(
      execStart(units.get("volume-data-volume.service")),
      /volume create/,
    );
  });
});
test("Harbor original stays blocked; only a test copy without logging yields 12 accepted units", () => {
  const source = fixture("harbor/v2.15.4/docker-compose.yml");
  const original = convertCompose(source);
  assert.equal(original.files.length, 0);
  assert.equal(
    original.diagnostics.filter((d) => d.severity === "error").length,
    20,
  );
  const document = parse(source);
  for (const service of Object.values(document.services))
    delete service.logging;
  const files = convert(stringify(document));
  assert.equal(
    files.filter((f) => f.filename.endsWith(".container")).length,
    11,
  );
  validate("harbor-test-only-no-logging", files, (units) => {
    assert(units.has("core.service"));
    assert(units.has("network-harbor-network.service"));
    const database = units.get("postgresql.service");
    hasArg(database, "--cap-add", "chown");
    hasArg(database, "--cap-drop", "all");
    hasArg(database, "--shm-size", "1073741824");
    hasArg(database, "--network", "systemd-network-harbor");
    assert.match(
      execStart(database),
      /(?:-v|--volume)(?:=|\s+)\/data\/database:\/var\/lib\/postgresql\/data:z/,
    );
    assert.match(units.get("core.service"), /^After=.*registry\.service/m);
    assert.match(units.get("core.service"), /^Requires=.*postgresql\.service/m);
    for (const unit of units.values())
      assert.doesNotMatch(execStart(unit), /--log-driver|--log-opt/);
  });
  assert.equal(fixture("harbor/v2.15.4/docker-compose.yml"), source);
});
test("real generator rejection cannot be mistaken for success", () => {
  assert.throws(
    () =>
      validate(
        "invalid",
        [
          {
            filename: "broken.container",
            content:
              "[Container]\nImage=nginx\nDeliberatelyInvalidQuadletKey=true\n",
          },
        ],
        () => {},
      ),
    /Quadlet dryrun failed|Missing\/unexpected generated units/,
  );
});
