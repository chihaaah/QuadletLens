import assert from "node:assert/strict";
import { basename } from "node:path";

export function expectedServices(files) {
  return files
    .map(({ filename }) => {
      if (filename.endsWith(".container"))
        return filename.replace(/\.container$/, ".service");
      if (filename.endsWith(".network"))
        return filename.replace(/\.network$/, "-network.service");
      if (filename.endsWith(".volume"))
        return filename.replace(/\.volume$/, "-volume.service");
      throw new Error(`Unsupported validation fixture file: ${filename}`);
    })
    .sort();
}

export function checkProcess(result, label) {
  if (result.error || result.status !== 0)
    throw new Error(
      `${label} failed (exit ${result.status}, signal ${result.signal ?? "none"}): ${result.error?.message ?? ""}\n${result.stderr ?? ""}\n${result.stdout ?? ""}`,
    );
}

export function parseDryRun(result, expected) {
  checkProcess(result, "Quadlet dryrun");
  const units = new Map();
  const headers = [
    ...result.stdout.matchAll(/^---([^\r\n]+\.service)---\r?\n/gm),
  ];
  for (let i = 0; i < headers.length; i++) {
    const name = basename(headers[i][1]);
    assert(!units.has(name), `Duplicate generated unit ${name}`);
    units.set(
      name,
      result.stdout.slice(
        headers[i].index + headers[i][0].length,
        headers[i + 1]?.index ?? result.stdout.length,
      ),
    );
  }
  assert.deepEqual(
    [...units.keys()].sort(),
    [...expected].sort(),
    `Missing/unexpected generated units. Generator stderr:\n${result.stderr}`,
  );
  for (const [name, text] of units)
    assert.match(text, /^\[Service\]$/m, `${name} is not a systemd service`);
  return units;
}

export function execStart(text) {
  const flattened = text
    .replace(/\\\r?\n\s*/g, "")
    .replace(/\\x([0-9a-f]{2})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/\\"/g, '"');
  const commands = flattened
    .split(/\r?\n/)
    .filter((line) => line.startsWith("ExecStart="));
  assert(commands.length, "Generated service has no ExecStart");
  return commands.join("\n");
}
