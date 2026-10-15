import { parseDocument } from "yaml";
import type { Diagnostic } from "./types.js";
type Dict = Record<string, unknown>;
const record = (value: unknown): value is Dict =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const owns = (value: Dict, key: string) => Object.hasOwn(value, key);
const entries = (value: Dict) =>
  Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

export interface ParsedCompose {
  root: unknown;
  diagnostics: Diagnostic[];
}
export function parseCompose(source: string): ParsedCompose {
  const diagnostics: Diagnostic[] = [];
  const error = (path: string, message: string, code: string) =>
    diagnostics.push({ severity: "error", code, path, message });
  let root: unknown;
  if (source.length > 1_000_000)
    return {
      root: undefined,
      diagnostics: [
        {
          severity: "error",
          code: "input-limit",
          path: "$",
          message: "Compose input must be at most 1 MB of text.",
        },
      ],
    };
  try {
    const document = parseDocument(source, { uniqueKeys: true, merge: true });
    for (const issue of document.errors)
      error("$", issue.message, "invalid-yaml");
    for (const issue of document.warnings)
      error("$", issue.message, "yaml-warning");
    if (diagnostics.length) return { root: undefined, diagnostics };
    root = document.toJS({ maxAliasCount: 100 });
  } catch (cause) {
    error(
      "$",
      cause instanceof Error ? cause.message : "Invalid YAML.",
      "invalid-yaml",
    );
    return { root: undefined, diagnostics };
  }
  if (!record(root)) {
    error("$", "Expected a Compose mapping.", "invalid-compose");
    return { root: undefined, diagnostics };
  }
  // No host environment or .env is available. Never guess interpolation values.
  let nodes = 0;
  const normalize = (
    value: unknown,
    path: string,
    ancestors = new Set<object>(),
  ): unknown => {
    if (++nodes > 50_000 || ancestors.size > 100) {
      if (!diagnostics.some((d) => d.code === "structure-limit"))
        error(
          path,
          "Input exceeds the supported nesting or structure size.",
          "structure-limit",
        );
      return null;
    }
    if (typeof value === "string") {
      if (/(?<!\$)(?:\$\$)*\$(?:\{|[a-zA-Z_])/.test(value))
        error(
          path,
          "Compose variable interpolation requires host/.env values. Replace variables with literal values before converting.",
          "interpolation",
        );
      return value.replaceAll("$$", "$");
    }
    if (value !== null && typeof value === "object") {
      if (ancestors.has(value)) {
        error(
          path,
          "Recursive YAML aliases are not supported.",
          "invalid-yaml",
        );
        return null;
      }
      const next = new Set(ancestors).add(value);
      if (Array.isArray(value))
        return value.map((v, i) => normalize(v, `${path}[${i}]`, next));
      if (record(value))
        return Object.fromEntries(
          entries(value).map(([k, v]) => [
            k,
            normalize(v, `${path}.${k}`, next),
          ]),
        );
    }
    return value;
  };
  root = normalize(root, "$");
  if (!record(root)) return { root: undefined, diagnostics };
  return { root, diagnostics };
}
