import type { Diagnostic } from "@compose2quadlet/core";
import type { Language } from "./preferences";
import { Icon } from "./Icon";
import { translate } from "./i18n";
import { diagnosticMessage } from "./diagnostics-i18n";
import { groupDiagnostics } from "./group-diagnostics";

function Entry({
  diagnostic: d,
  language,
}: {
  diagnostic: Diagnostic;
  language: Language;
}) {
  return (
    <div className={`diagnostic-entry ${d.severity}`}>
      <span className="severity">
        <Icon
          name={
            d.severity === "warning"
              ? "warning"
              : d.severity === "info"
                ? "info"
                : "error"
          }
        />
        {translate(
          language,
          d.severity === "warning"
            ? "warning"
            : d.severity === "info"
              ? "info"
              : d.code === "unsupported"
                ? "unsupported"
                : "error",
        )}
      </span>
      <div>
        <code>{d.path}</code>
        <p>{diagnosticMessage(d, language)}</p>
      </div>
    </div>
  );
}
export function DiagnosticList({
  diagnostics,
  language,
}: {
  diagnostics: readonly Diagnostic[];
  language: Language;
}) {
  return (
    <ul>
      {groupDiagnostics(diagnostics).map((group, index) => (
        <li key={index}>
          {group.kind === "logging" && group.diagnostics.length > 1 ? (
            <details className="logging-group">
              <summary>
                <Icon name="error" />
                <span>
                  <strong>{translate(language, "loggingGroup")}</strong>
                  <span className="group-count">
                    {translate(language, "loggingCount", {
                      count: group.errorCount,
                      services: group.serviceCount,
                    })}
                  </span>
                  <span className="group-description">
                    {translate(language, "loggingMigration")}
                  </span>
                </span>
                <span className="group-disclosure">
                  <span className="when-collapsed">
                    {translate(language, "showDetails")}
                  </span>
                  <span className="when-expanded">
                    {translate(language, "hideDetails")}
                  </span>
                </span>
              </summary>
              <ul>
                {group.diagnostics.map((d, i) => (
                  <li key={i}>
                    <Entry diagnostic={d} language={language} />
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            group.diagnostics.map((d, i) => (
              <Entry key={i} diagnostic={d} language={language} />
            ))
          )}
        </li>
      ))}
    </ul>
  );
}
