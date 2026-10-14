import type { Diagnostic } from "@compose2quadlet/core";

export interface DiagnosticGroup {
  kind: "logging" | "single";
  diagnostics: readonly Diagnostic[];
  errorCount: number;
  serviceCount: number;
}

/** Presentation only: never mutate, deduplicate or remove core diagnostics. */
export function groupDiagnostics(
  diagnostics: readonly Diagnostic[],
): DiagnosticGroup[] {
  const groups: DiagnosticGroup[] = [];
  let logging: DiagnosticGroup | undefined;
  const services = new Set<string>();
  for (const diagnostic of diagnostics) {
    const match = /^\$\.services\.([^.]+)\.logging(?:\.|$)/.exec(
      diagnostic.path,
    );
    if (match && diagnostic.severity === "error") {
      if (!logging) {
        logging = {
          kind: "logging",
          diagnostics: [],
          errorCount: 0,
          serviceCount: 0,
        };
        groups.push(logging);
      }
      logging.diagnostics = [...logging.diagnostics, diagnostic];
      logging.errorCount++;
      services.add(match[1]!);
      logging.serviceCount = services.size;
    } else
      groups.push({
        kind: "single",
        diagnostics: [diagnostic],
        errorCount: diagnostic.severity === "error" ? 1 : 0,
        serviceCount: 0,
      });
  }
  return logging
    ? [logging, ...groups.filter((group) => group !== logging)]
    : groups;
}
