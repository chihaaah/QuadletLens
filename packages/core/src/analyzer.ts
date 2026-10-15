import type {
  CompatibilitySummary,
  Diagnostic,
  FindingCategory,
  GeneratedFile,
  MigrationFinding,
  ServiceCompatibility,
} from "./types.js";
import { directiveRequirement } from "./capabilities.js";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const serviceOf = (path: string) => /^\$\.services\.([^.\[]+)/.exec(path)?.[1];
const featureOf = (path: string) =>
  /^\$\.services\.[^.]+\.([^.\[]+)/.exec(path)?.[1] ?? path;
const loggingPath = (path: string) =>
  /^\$\.services\.[^.]+\.logging(?:\.|$)/.test(path);

function diagnosticFinding(d: Diagnostic, index: number): MigrationFinding {
  const service = serviceOf(d.path);
  const logging = loggingPath(d.path);
  const invalid =
    d.code.startsWith("invalid-") ||
    [
      "input-limit",
      "structure-limit",
      "missing-reference",
      "name-collision",
      "dependency-cycle",
      "interpolation",
      "yaml-warning",
    ].includes(d.code);
  const category: FindingCategory =
    logging && !invalid
      ? "manual-migration"
      : d.severity === "error"
        ? invalid
          ? "invalid"
          : "unsupported"
        : d.severity === "warning"
          ? ["restart", "depends_on"].includes(featureOf(d.path)) ||
            /^\$\.(networks|volumes)\./.test(d.path)
            ? "semantic-difference"
            : "review"
          : "review";
  return {
    id: `diagnostic-${index}`,
    code: logging && !invalid ? "logging-manual-migration" : d.code,
    severity: d.severity,
    category,
    path: d.path,
    ...(service ? { service } : {}),
    feature: featureOf(d.path),
    summary: d.message,
    diagnostic: d,
    remediation:
      logging && !invalid
        ? "manual-logging"
        : invalid
          ? "resolve-invalid"
          : d.severity === "error"
            ? "migrate-unsupported"
            : "inspect-host",
    // An invalid logging object must not be described as an understood omission.
    previewOmission: logging && !invalid && d.code === "unsupported",
  };
}
const sourceFields: Readonly<Record<string, string>> = {
  Image: "image",
  ContainerName: "container_name",
  PublishPort: "ports",
  Environment: "environment",
  EnvironmentFile: "env_file",
  Exec: "command",
  Entrypoint: "entrypoint",
  User: "user",
  WorkingDir: "working_dir",
  Volume: "volumes",
  Network: "networks",
  NetworkAlias: "networks",
  AddCapability: "cap_add",
  DropCapability: "cap_drop",
  ShmSize: "shm_size",
};

/** Findings are projections of the same validation diagnostics and actual planned directives. */
export function analyzePlan(
  files: GeneratedFile[],
  diagnostics: Diagnostic[],
  target?: string,
): MigrationFinding[] {
  const findings = diagnostics.map(diagnosticFinding);
  for (const file of files) {
    if (!file.filename.endsWith(".container")) continue;
    const service = file.filename.slice(0, -10);
    const directives = new Set(
      [...file.content.matchAll(/^([A-Za-z]+)=/gm)].map((match) => match[1]!),
    );
    for (const directive of directives) {
      const feature = sourceFields[directive];
      if (!feature) continue;
      const path = `$.services.${service}.${feature}`;
      if (
        diagnostics.some(
          (d) =>
            d.severity === "error" &&
            (d.path === path ||
              d.path.startsWith(`${path}.`) ||
              d.path.startsWith(`${path}[`)),
        )
      )
        continue;
      const requirement = directiveRequirement(directive, target);
      findings.push({
        id: `mapping-${service}-${directive}`,
        code: "direct-mapping",
        severity: "info",
        category: "direct",
        path,
        service,
        feature,
        summary: `${feature} maps to ${directive}.`,
        remediation: "none",
        previewOmission: false,
        targetRequirement: requirement,
      });
      if (requirement.status === "requires-newer") {
        const diagnostic: Diagnostic = {
          severity: "error",
          code: "target-version",
          path,
          message: `${directive} requires Podman >= ${requirement.minimumVersion}; target is ${target}.`,
        };
        diagnostics.push(diagnostic);
        findings.push({
          id: `version-${service}-${directive}`,
          code: "target-version",
          severity: "error",
          category: "version-dependent",
          path,
          service,
          feature,
          summary: diagnostic.message,
          remediation: "upgrade-target",
          previewOmission: false,
          targetRequirement: requirement,
          diagnostic,
        });
      }
    }
    // No invented minima for the remaining emitted directives or their value semantics.
    findings.push({
      id: `runtime-${service}`,
      code: "runtime-verification",
      severity: "info",
      category: "version-dependent",
      path: `$.services.${service}`,
      service,
      feature: "runtime",
      summary:
        "Verify the complete generated unit with the target host's installed Quadlet generator and runtime.",
      remediation: "verify-runtime",
      previewOmission: false,
    });
  }
  return findings;
}

export function summarize(
  root: unknown,
  findings: MigrationFinding[],
): { summary: CompatibilitySummary; services: ServiceCompatibility[] } {
  const document = isRecord(root) ? root : {};
  const names = isRecord(document.services)
    ? Object.keys(document.services).sort()
    : [];
  const networkNames = new Set(
    isRecord(document.networks) ? Object.keys(document.networks) : [],
  );
  if (
    isRecord(document.services) &&
    Object.values(document.services).some(
      (s) =>
        isRecord(s) && (!Object.hasOwn(s, "networks") || s.networks === null),
    )
  )
    networkNames.add("default");
  const blockers = findings.filter((f) => f.severity === "error");
  const globalBlockers = blockers.filter(
    (f) => !f.service || !names.includes(f.service),
  );
  const services = names.map((name): ServiceCompatibility => {
    const local = findings.filter((f) => f.service === name);
    const blockedBy = [
      ...globalBlockers,
      ...blockers.filter((f) => f.service === name),
    ].map((f) => f.id);
    return {
      name,
      status: blockedBy.length
        ? "blocked"
        : local.some((f) => f.severity === "warning")
          ? "review"
          : "ready",
      findingIds: [...globalBlockers, ...local].map((f) => f.id),
      blockedBy,
    };
  });
  const byCategory: Record<FindingCategory, number> = {
    direct: 0,
    review: 0,
    "semantic-difference": 0,
    "version-dependent": 0,
    "manual-migration": 0,
    unsupported: 0,
    invalid: 0,
  };
  for (const finding of findings) byCategory[finding.category]++;
  const logging = blockers.filter((f) => f.code === "logging-manual-migration");
  return {
    services,
    summary: {
      status: blockers.length
        ? "blocked"
        : findings.some((f) => f.severity === "warning")
          ? "review"
          : "ready",
      services: names.length,
      networks: networkNames.size,
      volumes: isRecord(document.volumes)
        ? Object.keys(document.volumes).length
        : 0,
      byCategory,
      blockingIssues: blockers.length,
      affectedServices: services.filter((s) => s.status === "blocked").length,
      manualServices: new Set(
        blockers
          .filter((f) => f.category === "manual-migration" && f.service)
          .map((f) => f.service),
      ).size,
      servicesByStatus: {
        ready: services.filter((s) => s.status === "ready").length,
        review: services.filter((s) => s.status === "review").length,
        blocked: services.filter((s) => s.status === "blocked").length,
      },
      logging: {
        blockingIssues: logging.length,
        affectedServices: new Set(logging.map((f) => f.service).filter(Boolean))
          .size,
      },
    },
  };
}
