import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { convertCompose, type ConversionResult } from "@compose2quadlet/core";
import { download, makeArchive } from "./download";
import { translate, type MessageKey, type Notice } from "./i18n";
import { MigrationReadiness, PreviewStatus } from "./MigrationReadiness";
import { canExport } from "./export-safety";
import { ExportActions } from "./ExportActions";
import { Icon } from "./Icon";
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
  const [targetMode, setTargetMode] = useState("default");
  const [targetVersion, setTargetVersion] = useState("");
  const [selected, setSelected] = useState("web.container");
  const [dirty, setDirty] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<Notice | undefined>();
  const fileInput = useRef<HTMLInputElement>(null);
  const tabButtons = useRef(new Map<string, HTMLButtonElement>());
  const visibleFiles = result.previewFiles;
  const exportEnabled = canExport(result, dirty);
  const active =
    visibleFiles.find((f) => f.filename === selected) ?? visibleFiles[0];
  const errors = result.diagnostics.filter(
    (d) => d.severity === "error",
  ).length;
  const edit = (value: string) => {
    setInput(value);
    setDirty(true);
    setNotice(undefined);
  };
  const convert = () => {
    const converted = convertCompose(
      input,
      targetMode === "custom" ? { targetPodmanVersion: targetVersion } : {},
    );
    setResult(converted);
    setSelected(
      converted.previewFiles.find((f) => f.filename.endsWith(".container"))
        ?.filename ??
        converted.previewFiles[0]?.filename ??
        "",
    );
    setDirty(false);
    setNotice(
      converted.files.length
        ? { key: "generated", values: { count: converted.files.length } }
        : {
            key: converted.previewFiles.length ? "previewGenerated" : "blocked",
          },
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
    const exportFile = result.files.find(
      (file) => file.filename === active?.filename,
    );
    if (!exportFile || !exportEnabled) return;
    try {
      await navigator.clipboard.writeText(exportFile.content);
      setNotice({ key: "copied", values: { filename: exportFile.filename } });
    } catch {
      setNotice({ key: "copyFailed" });
    }
  };
  const zip = () => {
    if (!exportEnabled) return;
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
    const length = visibleFiles.length;
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
    const filename = visibleFiles[next]?.filename;
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
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
          <a
            className="github-link"
            href="https://github.com/chihaaah/compose2quadlet"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <Icon name="external" />
          </a>
        </div>
      </header>
      <main>
        <div className="target-controls">
          <label htmlFor="target-mode">{t("target")}</label>
          <select
            id="target-mode"
            value={targetMode}
            onChange={(event) => {
              setTargetMode(event.target.value);
              setDirty(true);
              setNotice(undefined);
            }}
          >
            <option value="default">{t("targetDefault")}</option>
            <option value="custom">{t("targetCustom")}</option>
          </select>
          {targetMode === "custom" && (
            <>
              <label className="sr-only" htmlFor="target-version">
                {t("targetVersion")}
              </label>
              <input
                id="target-version"
                placeholder="5.2.0"
                value={targetVersion}
                onChange={(event) => {
                  setTargetVersion(event.target.value);
                  setDirty(true);
                  setNotice(undefined);
                }}
              />
            </>
          )}
        </div>
        {dirty && (
          <p className="review-note" role="status">
            {t("staleDiagnostics")}
          </p>
        )}
        <MigrationReadiness
          key={result.findings.map((f) => f.id).join("|")}
          result={result}
          language={language}
        />
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
                <Icon name="open" />
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
              aria-invalid={errors > 0 && !dirty}
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
              <h2 id="output-heading">{t("previewHeading")}</h2>
              <span className="file-count">
                {t("files", { count: visibleFiles.length })}
              </span>
            </div>
            <div
              className="file-tabs"
              role="tablist"
              aria-label={t("fileList")}
            >
              {visibleFiles.map((f, i) => (
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
            {active && (
              <PreviewStatus
                file={active}
                result={result}
                language={language}
              />
            )}
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
              <div className="empty">{t("noPreview")}</div>
            )}
            <ExportActions
              result={result}
              dirty={dirty}
              selected={active?.filename}
              language={language}
              onCopy={() => void copy()}
              onZip={zip}
              onDownload={() => {
                const exportFile = result.files.find(
                  (file) => file.filename === active?.filename,
                );
                if (exportFile && exportEnabled) {
                  download(exportFile.filename, exportFile.content);
                  setNotice({
                    key: "fileSaved",
                    values: { filename: exportFile.filename },
                  });
                }
              }}
            />
          </section>
        </div>
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
