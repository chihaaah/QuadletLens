import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { convertCompose, type ConversionResult } from "@compose2quadlet/core";
import { download, makeArchive } from "./download";
import "./style.css";

const sample = `services:
  web:
    image: nginx:latest
    ports:
      - "8080:80"
    restart: unless-stopped
`;

function App() {
  const [input, setInput] = useState(sample);
  const [result, setResult] = useState<ConversionResult>(() =>
    convertCompose(sample),
  );
  const [selected, setSelected] = useState("web.container");
  const [dirty, setDirty] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
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
    setNotice("");
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
        ? `Generated ${converted.files.length} files. Review diagnostics before using them.`
        : "Conversion blocked. Resolve the errors below.",
    );
  };
  const load = async (files: FileList | File[]) => {
    if (files.length !== 1) {
      setNotice("Choose one .yml or .yaml file.");
      return;
    }
    const file = files[0];
    if (!file || !/\.ya?ml$/i.test(file.name)) {
      setNotice("Choose a .yml or .yaml file.");
      return;
    }
    if (file.size > 1_000_000) {
      setNotice("Choose a file smaller than 1 MB.");
      return;
    }
    try {
      edit(await file.text());
      setNotice(`Loaded ${file.name}. Select Convert to update the output.`);
    } catch {
      setNotice("This file could not be read. Try choosing it again.");
    }
  };
  const copy = async () => {
    if (!active || dirty) return;
    try {
      await navigator.clipboard.writeText(active.content);
      setNotice(`Copied ${active.filename}.`);
    } catch {
      setNotice(
        "Clipboard access is unavailable. Select the output text and copy it manually.",
      );
    }
  };
  const zip = () => {
    try {
      download(
        "compose2quadlet.zip",
        new Uint8Array(makeArchive(result.files)).buffer,
        "application/zip",
      );
      setNotice("ZIP downloaded.");
    } catch {
      setNotice(
        "The ZIP could not be created. Try downloading files individually.",
      );
    }
  };
  return (
    <div className="app">
      <header>
        <a className="brand" href="./" aria-label="Compose2Quadlet home">
          <span className="logo">
            C<span>2</span>Q
          </span>{" "}
          Compose<span className="muted">2</span>Quadlet{" "}
          <span className="badge">MVP</span>
        </a>
        <a
          className="repo"
          href="https://github.com/chihaaah/compose2quadlet"
          target="_blank"
          rel="noreferrer"
        >
          Source ↗
        </a>
      </header>
      <main>
        <div className="intro">
          <div className="eyebrow">COMPOSE IN. QUADLET OUT.</div>
          <h1>
            Give your containers
            <br />a systemd home.
          </h1>
          <p>
            Turn Docker Compose into Podman Quadlet files.
            <br />
            Review the mappings, then take your units with you.
          </p>
        </div>
        <div className="privacy">
          <span aria-hidden="true">◈</span>
          <div>
            <strong>
              No uploads. Your Compose file stays in your browser.
            </strong>
            <small>
              Conversion, copying, and ZIP creation happen locally. No account
              required.
            </small>
          </div>
        </div>
        <div className="workspace">
          <section
            className={`panel input-panel ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void load(e.dataTransfer.files);
            }}
          >
            <div className="panel-heading">
              <div>
                <span className="step">01</span>
                <h2>Compose source</h2>
              </div>
              <span className="format">YAML</span>
            </div>
            <div className="source-tools">
              <label className="file-button">
                Open YAML
                <input
                  type="file"
                  accept=".yml,.yaml"
                  onChange={(e) => {
                    if (e.target.files) void load(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <button className="text-button" onClick={() => edit(sample)}>
                Load sample
              </button>
              <span>or drop a file here</span>
            </div>
            <label className="sr-only" htmlFor="compose-input">
              Docker Compose YAML
            </label>
            <textarea
              id="compose-input"
              spellCheck={false}
              value={input}
              onChange={(e) => edit(e.target.value)}
              aria-describedby="input-help"
            />
            <div className="panel-footer">
              <span id="input-help">
                {input.split("\n").length} lines · .yml / .yaml
              </span>
              <button className="primary" onClick={convert}>
                Convert <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>
          <section className="panel output-panel">
            <div className="panel-heading">
              <div>
                <span className="step">02</span>
                <h2>Quadlet files</h2>
              </div>
              <span className="format">{result.files.length} FILES</span>
            </div>
            <div
              className="file-tabs"
              role="tablist"
              aria-label="Generated files"
            >
              {result.files.map((f) => (
                <button
                  key={f.filename}
                  id={`tab-${f.filename}`}
                  role="tab"
                  aria-selected={active?.filename === f.filename}
                  aria-controls="generated-output"
                  onClick={() => setSelected(f.filename)}
                >
                  {f.filename}
                </button>
              ))}
            </div>
            {dirty && (
              <div className="stale">
                Source changed. Convert again to refresh and enable exports.
              </div>
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
              <div className="empty">
                <strong>Resolve errors to generate files.</strong>
                <span>
                  Diagnostics below point to the settings that need attention.
                </span>
              </div>
            )}
            <div className="panel-footer">
              <button disabled={!active || dirty} onClick={() => void copy()}>
                Copy file
              </button>
              <div className="export-actions">
                <button
                  disabled={!active || dirty}
                  onClick={() =>
                    active && download(active.filename, active.content)
                  }
                >
                  Download file
                </button>
                <button
                  className="primary"
                  disabled={!result.files.length || dirty}
                  onClick={zip}
                >
                  Download ZIP ↓
                </button>
              </div>
            </div>
          </section>
        </div>
        <section className="diagnostics" aria-label="Conversion diagnostics">
          <div className="diagnostic-heading">
            <h2>Conversion review</h2>
            <div>
              <span className={errors ? "error-count" : ""}>
                {errors} errors
              </span>
              <span>{warnings} to review</span>
            </div>
          </div>
          {result.diagnostics.length ? (
            <ul>
              {result.diagnostics.map((d, i) => (
                <li key={i} className={d.severity}>
                  <span className="severity">
                    {d.severity === "warning"
                      ? "REVIEW"
                      : d.severity.toUpperCase()}
                  </span>
                  <div>
                    <code>{d.path}</code>
                    <p>{d.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="clean">No conversion issues found.</p>
          )}
          {dirty && (
            <p className="review-note">
              Diagnostics reflect the previous conversion. Convert the edited
              source to update them.
            </p>
          )}
        </section>
        <p className="notice" role="status" aria-live="polite">
          {notice || "\u00a0"}
        </p>
        <footer>
          <span>Made for Podman + systemd.</span>
          <span>
            Review generated units before installing on your Linux host.
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
