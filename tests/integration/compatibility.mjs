import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function validateFedoraRelease(release) {
  if (typeof release !== "string" || !/^[1-9]\d{1,2}$/.test(release))
    throw new Error("FEDORA_RELEASE must be an explicit numeric Fedora major release (for example, a configured compatibility target).");
  return release;
}

export function parseCompatibility(text) {
  const config = JSON.parse(text);
  if (!config || !Array.isArray(config.fedora) || config.fedora.length < 2)
    throw new Error("Compatibility configuration requires at least two Fedora releases.");
  const fedora = config.fedora.map(validateFedoraRelease);
  if (new Set(fedora).size !== fedora.length)
    throw new Error("Compatibility configuration has duplicate Fedora releases.");
  return { fedora };
}

export function artifactName(release) {
  return `quadlet-fedora-${validateFedoraRelease(release)}-output`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === "--check-release")
    validateFedoraRelease(process.argv[3]);
  else
    console.log(JSON.stringify(parseCompatibility(readFileSync(new URL("./compatibility.json", import.meta.url), "utf8"))));
}
