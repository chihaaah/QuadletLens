import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { convertCompose, type ConversionResult } from "@compose2quadlet/core";
import { download, makeArchive } from "./download";
import { translate, type MessageKey, type Notice } from "./i18n";
import { diagnosticMessage } from "./diagnostics-i18n";
import {
  browserLanguage,
  preferenceKeys,
  readPreference,
  savePreference,
  storage,
  type Language,
  type Theme,
} from "./preferences";
import "./style.css";

const sample = `services:
  web:
    image: nginx:latest
    ports:
      - "8080:80"
    restart: unless-stopped
`;
const themeQuery = "(prefers-color-scheme: dark)";

function App() {
  const [language, setLanguage] = useState<Language>(() => {
    const local = storage();
    return (
      (local &&
        readPreference(local, preferenceKeys.language, [
          "en",
          "ja",
        ] as const)) ||
      browserLanguage(navigator.language)
    );
  });
  const [themePreference, setThemePreference] = useState<Theme | undefined>(
    () => {
      const local = storage();
      return local
        ? readPreference(local, preferenceKeys.theme, [
            "light",
            "dark",
          ] as const)
        : undefined;
    },
  );
  const [systemTheme, setSystemTheme] = useState<Theme>(() =>
    window.matchMedia(themeQuery).matches ? "dark" : "light",
  );
  const theme = themePreference ?? systemTheme;
  const t = (key: MessageKey, values?: Record<string, string | number>) =>
    translate(language, key, values);
  useEffect(() => {
    const media = window.matchMedia(themeQuery);
    const change = () => setSystemTheme(media.matches ? "dark" : "light");
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#202328" : "#f5f5f2");
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const changeLanguage = (next: Language) => {
    setLanguage(next);
    const local = storage();
    if (local) savePreference(local, preferenceKeys.language, next);
  };
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setThemePreference(next);
    const local = storage();
    if (local) savePreference(local, preferenceKeys.theme, next);
  };

  const [input, setInput] = useState(sample);
  const [result, setResult] = useState<ConversionResult>(() =>
    convertCompose(sample),
  );
  const [selected, setSelected] = useState("web.container");
  const [dirty, setDirty] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<Notice | undefined>();
  const fileInput = useRef<HTMLInputElement>(null);
  const tabButtons = useRef(new Map<string, HTMLButtonElement>());
  const active =
    result.files.find((f) => f.filename === selected) ?? result.files[0];
  const errors = result.diagnostics.filter(
    (d) => d.severity === "error",
  ).length;
  const warnings = result.diagnostics.filter(
    (d) => d.severity === "warning",
  ).length;
  const edit = (value: string) => {
    setInput(value);
    setDirty(true);
    setNotice(undefined);
  };
  const convert = () => {
    const converted = convertCompose(input);
    setResult(converted);
    setSelected(
      converted.files.find((f) => f.filename.endsWith(".container"))
        ?.filename ??
        converted.files[0]?.filename ??
        "",
    );
    setDirty(false);
    setNotice(
      converted.files.length
        ? { key: "generated", values: { count: converted.files.length } }
        : { key: "blocked" },
    );
  };
  const load = async (files: FileList | File[]) => {
    const file = files[0];
    if (files.length !== 1 || !file || !/\.ya?ml$/i.test(file.name)) {
      setNotice({ key: "chooseFile" });
      return;
    }
    if (file.size > 1_000_000) {
      setNotice({ key: "tooLarge" });
      return;
    }
    try {
      edit(await file.text());
      setNotice({ key: "loaded", values: { filename: file.name } });
    } catch {
      setNotice({ key: "readFailed" });
    }
  };
  const copy = async () => {
    if (!active || dirty) return;
    try {
      await navigator.clipboard.writeText(active.content);
      setNotice({ key: "copied", values: { filename: active.filename } });
    } catch {
      setNotice({ key: "copyFailed" });
    }
  };
  const zip = () => {
    if (dirty || !result.files.length) return;
    try {
      download(
        "compose2quadlet.zip",
        new Uint8Array(makeArchive(result.files)).buffer,
        "application/zip",
      );
      setNotice({ key: "zipSaved" });
    } catch {
      setNotice({ key: "zipFailed" });
    }
  };
  const tabKey = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const length = result.files.length;
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % length
        : event.key === "ArrowLeft"
          ? (index + length - 1) % length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? length - 1
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    const filename = result.files[next]?.filename;
    if (filename) {
      setSelected(filename);
      tabButtons.current.get(filename)?.focus();
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <a href="./" aria-label={t("home")}>
            Compose2Quadlet
          </a>
        </h1>
        <div className="header-controls">
          <div
            className="language-switch"
            role="group"
            aria-label={t("language")}
          >
            <button
              lang="en"
              aria-label="English"
              aria-pressed={language === "en"}
              onClick={() => changeLanguage("en")}
            >
              EN
            </button>
            <span aria-hidden="true">/</span>
            <button
              lang="ja"
              aria-label="日本語"
              aria-pressed={language === "ja"}
              onClick={() => changeLanguage("ja")}
            >
              JP
            </button>
          </div>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={t(theme === "dark" ? "switchLight" : "switchDark")}
            title={t(theme === "dark" ? "switchLight" : "switchDark")}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              {theme === "dark" ? (
                <>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
                </>
              ) : (
                <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" />
              )}
            </svg>
            <span>{t(theme === "dark" ? "dark" : "light")}</span>
          </button>
          <a
            className="github-link"
            href="https://github.com/chihaaah/compose2quadlet"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>
      <main>
        <div className="workspace">
          <section
            aria-labelledby="source-heading"
            className={`pane input-pane ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (e.dataTransfer.types.includes("Files")) setDragging(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void load(e.dataTransfer.files);
            }}
          >
            <div className="pane-heading">
              <h2 id="source-heading">{t("source")}</h2>
              <span className="format">YAML</span>
            </div>
            <div className="toolbar source-tools">
              <button onClick={() => fileInput.current?.click()}>
                {t("open")}
              </button>
              <input
                ref={fileInput}
                hidden
                type="file"
                accept=".yml,.yaml"
                onChange={(e) => {
                  if (e.target.files) void load(e.target.files);
                  e.target.value = "";
                }}
              />
              <button className="quiet" onClick={() => edit(sample)}>
                {t("sample")}
              </button>
              <span className="drop-hint">{t("drop")}</span>
            </div>
            <label className="sr-only" htmlFor="compose-input">
              {t("editor")}
            </label>
            <textarea
              id="compose-input"
              spellCheck={false}
              value={input}
              wrap="off"
              onChange={(e) => edit(e.target.value)}
              aria-describedby="input-help"
            />
            <div className="pane-footer">
              <span id="input-help">
                {t("lines", { count: input.split("\n").length })}
              </span>
              <button className="primary" onClick={convert}>
                {t("convert")}
              </button>
            </div>
          </section>
          <section
            className="pane output-pane"
            aria-labelledby="output-heading"
          >
            <div className="pane-heading">
              <h2 id="output-heading">{t("output")}</h2>
              <span className="file-count">
                {t("files", { count: result.files.length })}
              </span>
            </div>
            <div
              className="file-tabs"
              role="tablist"
              aria-label={t("fileList")}
            >
              {result.files.map((f, i) => (
                <button
                  key={f.filename}
                  ref={(element) => {
                    if (element) tabButtons.current.set(f.filename, element);
                    else tabButtons.current.delete(f.filename);
                  }}
                  id={`tab-${f.filename}`}
                  role="tab"
                  aria-selected={active?.filename === f.filename}
                  aria-controls="generated-output"
                  tabIndex={active?.filename === f.filename ? 0 : -1}
                  onClick={() => setSelected(f.filename)}
                  onKeyDown={(e) => tabKey(e, i)}
                >
                  {f.filename}
                </button>
              ))}
            </div>
            {dirty && <p className="stale">{t("changed")}</p>}
            {active ? (
              <div
                className="output"
                id="generated-output"
                role="tabpanel"
                aria-labelledby={`tab-${active.filename}`}
                tabIndex={0}
              >
                <pre>
                  {active.content
                    .trimEnd()
                    .split("\n")
                    .map((line, i) => (
                      <div key={i} className="code-line">
                        <span className="line-number" aria-hidden="true">
                          {i + 1}
                        </span>
                        <code>
                          {line.startsWith("[") ? (
                            <span className="section-name">{line}</span>
                          ) : line.startsWith("#") ? (
                            <span className="comment">{line}</span>
                          ) : line.includes("=") ? (
                            <>
                              <span className="key">
                                {line.slice(0, line.indexOf("="))}
                              </span>
                              <span className="equals">=</span>
                              {line.slice(line.indexOf("=") + 1)}
                            </>
                          ) : (
                            line || " "
                          )}
                        </code>
                      </div>
                    ))}
                </pre>
              </div>
            ) : (
              <div className="empty">{t("empty")}</div>
            )}
            <div className="pane-footer export-actions">
              <button disabled={!active || dirty} onClick={() => void copy()}>
                {t("copy")}
              </button>
              <button
                disabled={!active || dirty}
                onClick={() => {
                  if (active) {
                    download(active.filename, active.content);
                    setNotice({
                      key: "fileSaved",
                      values: { filename: active.filename },
                    });
                  }
                }}
              >
                {t("download")}
              </button>
              <button disabled={!result.files.length || dirty} onClick={zip}>
                {t("downloadAll")} <span className="zip-label">ZIP</span>
              </button>
            </div>
          </section>
        </div>
        <section className="diagnostics" aria-labelledby="diagnostics-heading">
          <div className="diagnostic-heading">
            <h2 id="diagnostics-heading">{t("diagnostics")}</h2>
            <div>
              <span className={errors ? "error-count" : ""}>
                {t("errors", { count: errors })}
              </span>
              <span>{t("warnings", { count: warnings })}</span>
            </div>
          </div>
          {dirty && <p className="review-note">{t("staleDiagnostics")}</p>}
          <div
            className="diagnostic-body"
            tabIndex={result.diagnostics.length ? 0 : undefined}
          >
            {result.diagnostics.length ? (
              <ul>
                {result.diagnostics.map((d, i) => (
                  <li key={i} className={d.severity}>
                    <span className="severity">
                      {t(
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
                  </li>
                ))}
              </ul>
            ) : (
              <p className="clean">{t("noIssues")}</p>
            )}
          </div>
        </section>
        <footer>
          <span>{t("privacy")}</span>
          <span className="notice" role="status" aria-live="polite">
            {notice ? t(notice.key, notice.values) : ""}
          </span>
        </footer>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
