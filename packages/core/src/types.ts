export interface GeneratedFile {
  filename: string;
  content: string;
}
export interface Diagnostic {
  severity: "info" | "warning" | "error";
  code: string;
  path: string;
  message: string;
  /** Issued only by the validator that understands the omitted feature. */
  migration?: { feature: "logging"; previewOmission: boolean };
}
export type FindingCategory =
  | "direct"
  | "review"
  | "semantic-difference"
  | "version-dependent"
  | "manual-migration"
  | "unsupported"
  | "invalid";
export type Readiness = "ready" | "review" | "blocked";
export interface TargetRequirement {
  directive: string;
  minimumVersion?: string;
  status: "supported" | "requires-newer" | "runtime-verification";
  evidence: string;
}
export interface MigrationFinding {
  id: string;
  code: string;
  severity: Diagnostic["severity"];
  category: FindingCategory;
  path: string;
  service?: string;
  feature: string;
  summary: string;
  detail?: string;
  remediation:
    | "inspect-host"
    | "manual-logging"
    | "resolve-invalid"
    | "migrate-unsupported"
    | "verify-runtime"
    | "upgrade-target"
    | "none";
  /** Explicit opt-in: only understood logging omissions may appear in previews. */
  previewOmission: boolean;
  targetRequirement?: TargetRequirement;
  diagnostic?: Diagnostic;
}
export interface PreviewFile extends GeneratedFile {
  exportable: boolean;
  /** Finding IDs for the complete transaction; never only this file's local errors. */
  blockedBy: string[];
  relatedBlockers: string[];
}
export interface ServiceCompatibility {
  name: string;
  status: Readiness;
  findingIds: string[];
  blockedBy: string[];
}
export interface CompatibilitySummary {
  status: Readiness;
  services: number;
  networks: number;
  volumes: number;
  byCategory: Record<FindingCategory, number>;
  blockingIssues: number;
  affectedServices: number;
  manualServices: number;
  /** Service counts are mutually exclusive; category counts count findings. */
  servicesByStatus: Record<Readiness, number>;
  logging: { blockingIssues: number; affectedServices: number };
}
export interface ConversionOptions {
  targetPodmanVersion?: string;
}
export interface ConversionResult {
  /** Exportable output only. Any blocking finding keeps this empty. */
  files: GeneratedFile[];
  previewFiles: PreviewFile[];
  diagnostics: Diagnostic[];
  findings: MigrationFinding[];
  summary: CompatibilitySummary;
  services: ServiceCompatibility[];
  targetPodmanVersion?: string;
}
