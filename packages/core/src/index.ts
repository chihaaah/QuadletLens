import { parseCompose } from "./parser.js";
import { planCompose } from "./planner.js";
import { analyzePlan, summarize } from "./analyzer.js";
import { generatePreview } from "./preview.js";
import { parsePodmanVersion } from "./capabilities.js";
import type { ConversionOptions, ConversionResult } from "./types.js";
export type * from "./types.js";
export { directiveCapabilities, directiveRequirement } from "./capabilities.js";

/** Browser-independent analysis. Preview validity and migration completeness are separate. */
export function analyzeCompose(
  source: string,
  options: ConversionOptions = {},
): ConversionResult {
  const parsed = parseCompose(source);
  const plan = planCompose(parsed);
  const target = options.targetPodmanVersion;
  if (target !== undefined && !parsePodmanVersion(target))
    plan.diagnostics.push({
      severity: "error",
      code: "invalid-target",
      path: "$targetPodmanVersion",
      message:
        "Target Podman must be a numeric major.minor or major.minor.patch version.",
    });
  const findings = analyzePlan(plan.files, plan.diagnostics, target);
  const previewFiles = generatePreview(plan.files, findings);
  const { summary, services } = summarize(parsed.root, findings);
  return {
    files: summary.blockingIssues ? [] : plan.files,
    previewFiles,
    diagnostics: plan.diagnostics,
    findings,
    summary,
    services,
    ...(target !== undefined ? { targetPodmanVersion: target } : {}),
  };
}
/** Backwards-compatible entry point; files retain their exportable-only meaning. */
export const convertCompose = analyzeCompose;
