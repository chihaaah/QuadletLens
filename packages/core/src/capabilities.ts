import type { TargetRequirement } from "./types.js";

// Earliest upstream release baselines confirmed by adjacent tagged source/docs.
// These are directive-presence gates, not a guarantee of all value/runtime semantics.
export const directiveCapabilities: Readonly<
  Record<string, { minimumVersion: string; evidence: string }>
> = {
  WorkingDir: {
    minimumVersion: "4.6.0",
    evidence:
      "https://github.com/containers/podman/blob/v4.6.0/pkg/systemd/quadlet/quadlet.go",
  },
  ShmSize: {
    minimumVersion: "4.7.0",
    evidence:
      "https://github.com/containers/podman/blob/v4.7.0/pkg/systemd/quadlet/quadlet.go",
  },
  Entrypoint: {
    minimumVersion: "5.0.0",
    evidence:
      "https://github.com/containers/podman/blob/v5.0.0/pkg/systemd/quadlet/quadlet.go",
  },
  NetworkAlias: {
    minimumVersion: "5.2.0",
    evidence:
      "https://github.com/containers/podman/blob/v5.2.0/docs/source/markdown/podman-systemd.unit.5.md",
  },
};
export function parsePodmanVersion(value: string): number[] | undefined {
  const match = /^v?(\d+)\.(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return;
  const parts = [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
  return parts.every(Number.isSafeInteger) ? parts : undefined;
}
export function directiveRequirement(
  directive: string,
  target?: string,
): TargetRequirement {
  const capability = directiveCapabilities[directive];
  if (!capability)
    return {
      directive,
      status: "runtime-verification",
      evidence:
        "https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html",
    };
  const actual = target ? parsePodmanVersion(target) : undefined;
  const minimum = parsePodmanVersion(capability.minimumVersion)!;
  const comparison = actual?.reduce(
    (result, value, index) => result || value - minimum[index]!,
    0,
  );
  return {
    directive,
    ...capability,
    status: actual
      ? comparison! < 0
        ? "requires-newer"
        : "supported"
      : "runtime-verification",
  };
}
