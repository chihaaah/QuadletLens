import type { ConversionResult } from "@quadletlens/core";
/** Only the public export transaction authorizes copy/download; preview content never does. */
export function canExport(result: ConversionResult, dirty: boolean): boolean {
  return (
    !dirty &&
    result.files.length > 0 &&
    result.summary.blockingIssues === 0 &&
    !result.diagnostics.some((d) => d.severity === "error")
  );
}
