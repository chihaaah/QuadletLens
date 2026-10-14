import { accessSync, constants, statSync } from "node:fs";
import { basename } from "node:path";

/** Discover executables from installed package files without encoding distro/version paths. */
export function installedBinary(packageFiles, name) {
  for (const path of [...new Set(packageFiles)].filter((p) => !name || basename(p) === name)) {
    try {
      accessSync(path, constants.X_OK);
      if (statSync(path).isFile()) return path;
    } catch { /* Skip missing files/broken links. */ }
  }
  return undefined;
}

export function runtimeMetadata({ fedora, podman, podmanRpm, systemd, systemdRpm, generator, commit }) {
  return {
    fedora: fedora || null,
    podman: podman.trim(),
    podmanRpm: podmanRpm?.trim() || null,
    systemd: systemd.trim(),
    systemdRpm: systemdRpm?.trim() || null,
    generator,
    commit: commit || null,
  };
}
