import { useState } from "react";
import type {
  ConversionResult,
  FindingCategory,
  MigrationFinding,
  PreviewFile,
} from "@compose2quadlet/core";
import { translate, type MessageKey } from "./i18n";
import { diagnosticMessage } from "./diagnostics-i18n";
import type { Language } from "./preferences";

const categories: Record<FindingCategory, MessageKey> = {
  direct: "direct",
  review: "reviewCategory",
  "semantic-difference": "semantic",
  "version-dependent": "versionCategory",
  "manual-migration": "manual",
  unsupported: "unsupported",
  invalid: "invalid",
};
const guidance: Record<
  MigrationFinding["remediation"],
  MessageKey | undefined
> = {
  "manual-logging": "loggingGuidance",
  "resolve-invalid": "invalidGuidance",
  "migrate-unsupported": "unsupportedGuidance",
  "verify-runtime": "runtimeGuidance",
  "upgrade-target": undefined,
  "inspect-host": "hostGuidance",
  none: undefined,
};
export function Finding({
  finding: f,
  language,
}: {
  finding: MigrationFinding;
  language: Language;
}) {
  const t = (key: MessageKey, values?: Record<string, string | number>) =>
    translate(language, key, values);
  const requirement = f.targetRequirement;
  const text =
    f.code === "direct-mapping"
      ? t("mapping", {
          feature: f.feature,
          directive: requirement?.directive ?? f.feature,
        })
      : f.code === "runtime-verification"
        ? t("runtimeGuidance")
        : f.code === "target-version"
          ? t("requiresVersion", {
              directive: requirement?.directive ?? "",
              version: requirement?.minimumVersion ?? "",
            })
          : f.code === "invalid-target"
            ? t("targetVersion")
            : f.diagnostic
              ? diagnosticMessage(f.diagnostic, language)
              : f.summary;
  const advice = guidance[f.remediation];
  return (
    <li className={`finding ${f.severity}`}>
      <span className="finding-label">{t(categories[f.category])}</span>{" "}
      <code>{f.path}</code>
      <p>{text}</p>
      {advice && f.code !== "runtime-verification" && (
        <p className="finding-guidance">{t(advice)}</p>
      )}
      {requirement && (
        <p className="finding-guidance">
          {requirement.status === "supported"
            ? t("supportedVersion", {
                directive: requirement.directive,
                version: requirement.minimumVersion ?? "",
              })
            : requirement.status === "requires-newer"
              ? t("requiresVersion", {
                  directive: requirement.directive,
                  version: requirement.minimumVersion ?? "",
                })
              : t("verifyVersion")}{" "}
          <a href={requirement.evidence} target="_blank" rel="noreferrer">
            Podman ↗
          </a>
        </p>
      )}
    </li>
  );
}
export function MigrationReadiness({
  result,
  language,
}: {
  result: ConversionResult;
  language: Language;
}) {
  const [service, setService] = useState("");
  const [category, setCategory] = useState("");
  const t = (key: MessageKey, values?: Record<string, string | number>) =>
    translate(language, key, values);
  const summary = result.summary;
  const filtered = result.findings.filter(
    (f) =>
      (!service || f.service === service) &&
      (!category || f.category === category),
  );
  return (
    <section
      className="migration-readiness"
      aria-labelledby="readiness-heading"
    >
      <div className="readiness-heading">
        <h2 id="readiness-heading">{t("readiness")}</h2>
        <strong className={`readiness-status ${summary.status}`}>
          {t(summary.status === "blocked" ? "blockedState" : summary.status)}
        </strong>
      </div>
      <p>
        {t("analyzed", {
          services: summary.services,
          manual: summary.manualServices,
          blockers: summary.blockingIssues,
        })}{" "}
        <span className="resource-counts">
          {t("resources", {
            networks: summary.networks,
            volumes: summary.volumes,
          })}
        </span>
      </p>
      <dl className="compatibility-counts">
        {Object.entries(categories).map(([key, label]) => (
          <div key={key}>
            <dt>{t(label)}</dt>
            <dd>{summary.byCategory[key as FindingCategory]}</dd>
          </div>
        ))}
      </dl>
      {summary.logging.blockingIssues > 0 && (
        <details className="logging-migration">
          <summary>
            {t("loggingGroup")} · {t("manual")} ·{" "}
            {t("loggingCount", {
              count: summary.logging.blockingIssues,
              services: summary.logging.affectedServices,
            })}
          </summary>
          <p>{t("loggingGuidance")}</p>
          <ul>
            {result.findings
              .filter((f) => f.code === "logging-manual-migration")
              .map((f) => (
                <Finding key={f.id} finding={f} language={language} />
              ))}
          </ul>
        </details>
      )}
      <details className="compatibility-details">
        <summary>{t("compatibilityDetails")}</summary>
        <div className="compatibility-filters">
          <label>
            {t("serviceFilter")}{" "}
            <select
              value={service}
              onChange={(event) => setService(event.target.value)}
            >
              <option value="">{t("all")}</option>
              {result.services.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("categoryFilter")}{" "}
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">{t("all")}</option>
              {Object.entries(categories).map(([key, label]) => (
                <option key={key} value={key}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p>{t("findings", { count: filtered.length })}</p>
        <ul className="finding-list">
          {filtered.map((f) => (
            <Finding key={f.id} finding={f} language={language} />
          ))}
        </ul>
      </details>
      <details className="service-readiness">
        <summary>{t("serviceReadiness")}</summary>
        {result.services.map((s) => (
          <details key={s.name}>
            <summary>
              <code>{s.name}</code> ·{" "}
              {t(s.status === "blocked" ? "blockedState" : s.status)}
            </summary>
            <ul>
              {result.findings
                .filter((f) => s.findingIds.includes(f.id))
                .map((f) => (
                  <Finding key={f.id} finding={f} language={language} />
                ))}
            </ul>
          </details>
        ))}
      </details>
    </section>
  );
}
export function PreviewStatus({
  file,
  result,
  language,
}: {
  file: PreviewFile;
  result: ConversionResult;
  language: Language;
}) {
  if (file.exportable) return null;
  const t = (key: MessageKey) => translate(language, key);
  return (
    <aside className="preview-status" role="note">
      <strong>{t("previewOnly")}</strong>
      <p>{t("previewBlocked")}</p>
      {file.relatedBlockers.length ? (
        <ul>
          {result.findings
            .filter((f) => file.relatedBlockers.includes(f.id))
            .map((f) => (
              <li key={f.id}>
                <code>{f.path}</code> —{" "}
                {t(
                  f.remediation === "manual-logging"
                    ? "loggingGuidance"
                    : "documentBlockers",
                )}
              </li>
            ))}
        </ul>
      ) : (
        <p>{t("documentBlockers")}</p>
      )}
    </aside>
  );
}
