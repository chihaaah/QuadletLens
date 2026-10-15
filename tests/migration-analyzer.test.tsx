import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  analyzeCompose,
  convertCompose,
  directiveRequirement,
} from "../packages/core/src/index";
import { canExport } from "../apps/web/src/export-safety";
import {
  MigrationReadiness,
  PreviewStatus,
} from "../apps/web/src/MigrationReadiness";
import { ExportActions } from "../apps/web/src/ExportActions";
import { generatePreview } from "../packages/core/src/preview";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const harbor = fixture("harbor/v2.15.4/docker-compose.yml");
const service = (extra = "") => `services:\n  app:\n    image: nginx\n${extra}`;
describe("migration analysis and export safety", () => {
  it("escapes unsupported logging keys in preview comments so paths cannot inject directives", () => {
    const result = analyzeCompose(service("    logging: { driver: syslog }\n"));
    const findings = result.findings.map((f) =>
      f.previewOmission
        ? { ...f, path: "$.services.app.logging.unknown\nImage=evil" }
        : f,
    );
    const file = generatePreview(
      [{ filename: "app.container", content: "[Container]\nImage=nginx\n" }],
      findings,
    )[0]!;
    expect(file.content.match(/^Image=/gm)).toHaveLength(1);
    expect(file.content).not.toContain("\nImage=evil");
    expect(file.content).toContain("unknown\\nImage=evil");
    expect(findings.some((f) => f.path.includes("unknown\nImage=evil"))).toBe(
      true,
    );
    expect(result.files).toEqual([]);
  });
  it("does not authorize omissions from a path that merely looks like logging", () => {
    for (const setting of [
      '    "logging.driver": syslog\n',
      "    logging: { driver: syslog, unknown: true }\n",
    ]) {
      const result = analyzeCompose(service(setting));
      expect(result.files).toEqual([]);
      expect(result.previewFiles).toEqual([]);
      expect(
        result.findings.some(
          (f) => f.severity === "error" && !f.previewOmission,
        ),
      ).toBe(true);
    }
  });
  it.each(["en", "ja"] as const)(
    "keeps all three actual %s export controls disabled for previews and stale results",
    (language) => {
      for (const [result, dirty] of [
        [analyzeCompose(harbor), false],
        [analyzeCompose(service()), true],
      ] as const) {
        const html = renderToStaticMarkup(
          <ExportActions
            result={result}
            dirty={dirty}
            selected={result.previewFiles[0]?.filename}
            language={language}
            onCopy={() => {}}
            onDownload={() => {}}
            onZip={() => {}}
          />,
        );
        expect(html.match(/disabled=""/g)).toHaveLength(3);
      }
      const result = analyzeCompose(service());
      const html = renderToStaticMarkup(
        <ExportActions
          result={result}
          dirty={false}
          selected="app.container"
          language={language}
          onCopy={() => {}}
          onDownload={() => {}}
          onZip={() => {}}
        />,
      );
      expect(html).not.toContain('disabled=""');
    },
  );
  it("retains the public converter and independently reusable analysis entry point", () => {
    expect(convertCompose).toBe(analyzeCompose);
    for (const name of ["nginx.yaml", "stack.yaml"]) {
      const result = analyzeCompose(fixture(name));
      expect(result.files.length).toBeGreaterThan(0);
      expect(
        result.previewFiles.every((f) => f.exportable && !f.blockedBy.length),
      ).toBe(true);
      expect(result.summary.blockingIssues).toBe(0);
      expect(result.summary.networks).toBeGreaterThan(0);
      expect(canExport(result, false)).toBe(true);
      expect(canExport(result, true)).toBe(false);
    }
  });
  it("keeps every original diagnostic linked to a structured finding without string inference", () => {
    const result = analyzeCompose(harbor);
    expect(
      result.findings.filter((f) => f.diagnostic).map((f) => f.diagnostic),
    ).toEqual(result.diagnostics);
    expect(
      result.findings.every(
        (f) => f.id && f.category && f.path && f.remediation,
      ),
    ).toBe(true);
    expect(new Set(result.findings.map((f) => f.id)).size).toBe(
      result.findings.length,
    );
    expect(
      Object.values(result.summary.byCategory).reduce((a, b) => a + b, 0),
    ).toBe(result.findings.length);
    expect(result.summary.byCategory.direct).toBeGreaterThan(0);
  });
  it("analyzes unchanged Harbor as 20 logging blockers across 10 of 11 services", () => {
    const result = analyzeCompose(harbor);
    expect(result.summary).toMatchObject({
      status: "blocked",
      services: 11,
      networks: 1,
      volumes: 0,
      blockingIssues: 20,
      affectedServices: 10,
      manualServices: 10,
      logging: { blockingIssues: 20, affectedServices: 10 },
    });
    expect(result.services.filter((s) => s.status === "blocked")).toHaveLength(
      10,
    );
    expect(result.services.find((s) => s.name === "log")?.status).toBe(
      "review",
    );
    expect(
      result.services.find((s) => s.name === "postgresql")?.blockedBy,
    ).toHaveLength(2);
    expect(result.files).toEqual([]);
    expect(fixture("harbor/v2.15.4/docker-compose.yml")).toBe(harbor);
  });
  it("generates 11 container previews and a network with explicit omissions and no logging substitutions", () => {
    const result = analyzeCompose(harbor);
    expect(result.previewFiles).toHaveLength(12);
    expect(
      result.previewFiles.filter((f) => f.filename.endsWith(".container")),
    ).toHaveLength(11);
    for (const file of result.previewFiles) {
      expect(file.exportable).toBe(false);
      expect(file.blockedBy).toHaveLength(20);
      expect(file.content).toContain("PREVIEW ONLY - NOT EXPORTABLE");
      expect(file.content).not.toMatch(
        /LogDriver=|LogOpt=|journald|PodmanArgs=/,
      );
    }
    const database = result.previewFiles.find(
      (f) => f.filename === "postgresql.container",
    )!;
    expect(database.relatedBlockers).toHaveLength(2);
    expect(database.content).toContain("$.services.postgresql.logging.driver");
    for (const text of [
      "DropCapability=ALL",
      "AddCapability=CHOWN",
      "ShmSize=1073741824",
    ])
      expect(database.content).toContain(text);
    const registry = result.previewFiles.find(
      (f) => f.filename === "registry.container",
    )!;
    for (const text of [
      "AddCapability=CHOWN",
      "Volume=/data/registry:/storage:z",
      "Network=network-harbor.network",
    ])
      expect(registry.content).toContain(text);
    expect(
      result.findings.some(
        (f) =>
          f.category === "direct" &&
          f.feature === "shm_size" &&
          f.service === "postgresql",
      ),
    ).toBe(true);
    expect(canExport(result, false)).toBe(false);
  });
  it.each([
    "services: [",
    service("    privileged: true\n"),
    service("    network_mode: host\n"),
    service("    image: ${IMAGE}\n"),
    service("    shm_size: nope\n"),
    service("    logging: null\n"),
  ])(
    "suppresses all preview when semantics cannot be safely inferred: %s",
    (source) => {
      const result = analyzeCompose(source);
      expect(result.files).toEqual([]);
      expect(result.previewFiles).toEqual([]);
      expect(
        result.findings.some(
          (f) => f.severity === "error" && !f.previewOmission,
        ),
      ).toBe(true);
    },
  );
  it("never loses unrelated unsupported paths when combined with an understood logging omission", () => {
    const result = analyzeCompose(
      service(
        "    logging: { driver: syslog }\n    healthcheck: { test: [CMD, true] }\n",
      ),
    );
    expect(
      result.findings.filter((f) => f.severity === "error").map((f) => f.path),
    ).toEqual(
      expect.arrayContaining([
        "$.services.app.healthcheck",
        "$.services.app.logging.driver",
      ]),
    );
    expect(result.previewFiles).toEqual([]);
    expect(canExport(result, false)).toBe(false);
  });
  it("does not enable export on an unaffected preview or forged empty export transaction", () => {
    const result = analyzeCompose(harbor);
    expect(
      result.previewFiles.find((f) => f.filename === "log.container")
        ?.exportable,
    ).toBe(false);
    expect(canExport({ ...result, files: result.previewFiles }, false)).toBe(
      false,
    );
    const good = analyzeCompose(service());
    expect(canExport({ ...good, files: [] }, false)).toBe(false);
  });
  it.each([
    ["WorkingDir", "4.6.0", "4.5.0"],
    ["ShmSize", "4.7.0", "4.6.0"],
    ["Entrypoint", "5.0.0", "4.9.0"],
    ["NetworkAlias", "5.2.0", "5.1.0"],
  ])("encodes only verified %s minimum %s", (directive, minimum, below) => {
    expect(directiveRequirement(directive, below).status).toBe(
      "requires-newer",
    );
    expect(directiveRequirement(directive, minimum)).toMatchObject({
      status: "supported",
      minimumVersion: minimum,
    });
    expect(directiveRequirement(directive).status).toBe("runtime-verification");
  });
  it("blocks an older target without silently dropping the required NetworkAlias directive", () => {
    const result = analyzeCompose(service(), { targetPodmanVersion: "5.1.0" });
    expect(result.files).toEqual([]);
    expect(result.previewFiles).toEqual([]);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: "target-version",
        service: "app",
        path: "$.services.app.networks",
        category: "version-dependent",
      }),
    );
    expect(result.summary.servicesByStatus.blocked).toBe(1);
    expect(
      analyzeCompose(service(), { targetPodmanVersion: "5.2" }).files,
    ).toHaveLength(2);
    expect(directiveRequirement("Image", "5.2").status).toBe(
      "runtime-verification",
    );
  });
  it.each(["", "latest", "5", "5.2.0-rc1", "NaN.2", "9007199254740992.1"])(
    "rejects invalid target %s without guessing",
    (targetPodmanVersion) => {
      const result = analyzeCompose(service(), { targetPodmanVersion });
      expect(result.findings.some((f) => f.code === "invalid-target")).toBe(
        true,
      );
      expect(result.files).toEqual([]);
      expect(result.previewFiles).toEqual([]);
    },
  );
  it.each([
    [
      "en",
      "Migration readiness",
      "PREVIEW ONLY — NOT EXPORTABLE",
      "20 errors across 10 services",
    ],
    [
      "ja",
      "移行の準備状況",
      "PREVIEW ONLY — エクスポート不可",
      "10 サービスで 20 件のエラー",
    ],
  ] as const)(
    "renders %s readiness, source paths and native accessible details",
    (language, title, previewLabel, loggingCount) => {
      const result = analyzeCompose(harbor),
        before = structuredClone(result);
      const html = renderToStaticMarkup(
        <>
          <MigrationReadiness result={result} language={language} />
          <PreviewStatus
            file={result.previewFiles[0]!}
            result={result}
            language={language}
          />
        </>,
      );
      for (const label of [
        title,
        previewLabel,
        loggingCount,
        "<details",
        "<summary",
        "<select",
      ])
        expect(html).toContain(label);
      for (const diagnostic of result.diagnostics)
        expect(html).toContain(diagnostic.path);
      expect(result).toEqual(before);
    },
  );
});
