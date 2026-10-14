import { describe, expect, it } from "vitest";
import {
  checkProcess,
  expectedServices,
  parseDryRun,
} from "./integration/generator-harness.mjs";

describe("Quadlet failure detection (no Podman needed)", () => {
  it("maps all supported service filename forms", () =>
    expect(
      expectedServices([
        { filename: "web.container" },
        { filename: "network-harbor.network" },
        { filename: "data.volume" },
      ]),
    ).toEqual([
      "data-volume.service",
      "network-harbor-network.service",
      "web.service",
    ]));
  it("rejects nonzero exit, timeout and spawn failure", () => {
    for (const result of [
      { status: 1, stderr: "unsupported key" },
      { status: null, signal: "SIGTERM" },
      { status: null, error: new Error("ENOENT") },
    ])
      expect(() => checkProcess(result, "generator")).toThrow(/failed/);
  });
  it("rejects exit zero with no output, partial output or wrong service names", () => {
    for (const stdout of [
      "",
      "---other.service---\n[Service]\n",
      "---web.service---\n[Service]\n",
    ])
      expect(() =>
        parseDryRun({ status: 0, stdout, stderr: "diagnostic" }, [
          "web.service",
          "network-default-network.service",
        ]),
      ).toThrow();
  });
  it("recognizes complete dryrun service output", () =>
    expect(
      parseDryRun(
        {
          status: 0,
          stdout: "---web.service---\n[Service]\nExecStart=podman run nginx\n",
          stderr: "",
        },
        ["web.service"],
      ).get("web.service"),
    ).toContain("ExecStart="));
});
