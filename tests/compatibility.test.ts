import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { artifactName, parseCompatibility, validateFedoraRelease } from "./integration/compatibility.mjs";
import { installedBinary, runtimeMetadata } from "./integration/runtime-environment.mjs";

describe("compatibility configuration and reports (no Podman needed)", () => {
  it("rejects absent, duplicate and invalid matrix targets", () => {
    for (const input of ["null", "{}", '{"fedora":[]}', '{"fedora":["90","90"]}', '{"fedora":["90","rawhide"]}', '{"fedora":[90,91]}'])
      expect(() => parseCompatibility(input)).toThrow();
    expect(parseCompatibility('{"fedora":["90","91"]}')).toEqual({ fedora: ["90", "91"] });
  });
  it("rejects unsafe/missing release arguments before bootstrap", () => {
    for (const release of [undefined, "", "0", "090", "../90", "90;id", "90\n", "rawhide"])
      expect(() => validateFedoraRelease(release)).toThrow(/FEDORA_RELEASE/);
    const result = spawnSync(process.execPath, ["tests/integration/compatibility.mjs", "--check-release", "../90"], { encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("FEDORA_RELEASE");
  });
  it("makes the configured matrix the source for unique job artifacts and manual/weekly runs", () => {
    const { fedora } = parseCompatibility(readFileSync("tests/integration/compatibility.json", "utf8"));
    expect(new Set(fedora.map(artifactName)).size).toBe(fedora.length);
    const emitted = spawnSync(process.execPath, ["tests/integration/compatibility.mjs"], { encoding: "utf8" });
    expect(emitted.status).toBe(0);
    expect(JSON.parse(emitted.stdout)).toEqual({ fedora });
    const workflow = parse(readFileSync(".github/workflows/ci.yml", "utf8"));
    expect(workflow.on).toHaveProperty("workflow_dispatch");
    expect(workflow.on.schedule).toHaveLength(1);
    expect(workflow.on.schedule[0].cron.split(" ").slice(2)).toEqual(["*", "*", "1"]);
    expect(workflow.jobs.quadlet.strategy["fail-fast"]).toBe(false);
    expect(workflow.jobs.quadlet.strategy.matrix).toBe("${{ fromJSON(needs.compatibility.outputs.matrix) }}");
    expect(workflow.jobs.quadlet.name).toBe("Quadlet / Fedora ${{ matrix.fedora }}");
    expect(workflow.jobs.quadlet.steps.find((step: { uses?: string }) => step.uses?.startsWith("actions/upload-artifact")).with.name)
      .toBe("quadlet-fedora-${{ matrix.fedora }}-output");
  });
  it("records actual version strings and round trips artifact metadata without assumed package versions", () => {
    const input = { fedora: "90", podman: "podman version 9.2.3\n", podmanRpm: "podman-9.2.3-7.fc90.x86_64\n", systemd: "systemd 999 (999.1)\n", systemdRpm: "systemd-999.1-2.fc90.x86_64\n", generator: "/opt/vendor/podman-system-generator", commit: "abc123" };
    const metadata = runtimeMetadata(input);
    expect(JSON.parse(JSON.stringify(metadata))).toEqual({ ...input, podman: input.podman.trim(), podmanRpm: input.podmanRpm.trim(), systemd: input.systemd.trim(), systemdRpm: input.systemdRpm.trim() });
    expect(runtimeMetadata({ ...input, fedora: undefined, podmanRpm: undefined, systemdRpm: undefined, commit: undefined })).toMatchObject({ fedora: null, podmanRpm: null, systemdRpm: null, commit: null });
  });
  it("discovers a generator at arbitrary installed paths, excluding directories and missing files", () => {
    const directory = mkdtempSync(join(tmpdir(), "quadlet-discovery-"));
    try {
      const dirCandidate = join(directory, "directory", "podman-system-generator");
      mkdirSync(dirCandidate, { recursive: true });
      const candidate = join(directory, "vendor", "podman-system-generator");
      mkdirSync(join(directory, "vendor"));
      writeFileSync(candidate, "test");
      chmodSync(candidate, 0o755);
      const files = [dirCandidate, join(directory, "missing", "podman-system-generator"), candidate];
      expect(installedBinary(files, "podman-system-generator")).toBe(candidate);
      expect(installedBinary(files, "systemd")).toBeUndefined();
      expect(installedBinary([candidate], undefined)).toBe(candidate);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
