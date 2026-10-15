import type { GeneratedFile, MigrationFinding, PreviewFile } from "./types.js";

/** Conservative whole-document gate: only explicitly understood omissions allow a preview. */
export function generatePreview(
  candidates: GeneratedFile[],
  findings: MigrationFinding[],
): PreviewFile[] {
  const blockers = findings.filter((f) => f.severity === "error");
  if (blockers.some((f) => !f.previewOmission)) return [];
  const blockedBy = blockers.map((f) => f.id);
  return candidates.map((file) => {
    const service = file.filename.endsWith(".container")
      ? file.filename.slice(0, -10)
      : undefined;
    const related = blockers.filter((f) => !f.service || f.service === service);
    return {
      ...file,
      exportable: blockers.length === 0,
      blockedBy: [...blockedBy],
      relatedBlockers: related.map((f) => f.id),
      content: blockers.length
        ? `# PREVIEW ONLY - NOT EXPORTABLE. Migration is incomplete.\n${related.map((f) => `# Omitted: ${f.path} (${f.code})\n`).join("")}${file.content}`
        : file.content,
    };
  });
}
