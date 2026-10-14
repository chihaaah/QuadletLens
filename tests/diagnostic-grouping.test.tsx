import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { convertCompose } from "../packages/core/src/index";
import { groupDiagnostics } from "../apps/web/src/group-diagnostics";
import { DiagnosticList } from "../apps/web/src/DiagnosticList";

const source = readFileSync(
  new URL("./fixtures/harbor/v2.15.4/docker-compose.yml", import.meta.url),
  "utf8",
);
describe("presentation-only Harbor diagnostic grouping", () => {
  it("groups 20 errors across 10 services without mutating or removing diagnostics", () => {
    const result = convertCompose(source),
      before = structuredClone(result);
    const groups = groupDiagnostics(result.diagnostics);
    const logging = groups.find((g) => g.kind === "logging")!;
    expect(logging.errorCount).toBe(20);
    expect(logging.serviceCount).toBe(10);
    expect(groups.flatMap((g) => g.diagnostics)).toHaveLength(
      result.diagnostics.length,
    );
    for (const d of result.diagnostics)
      expect(groups.flatMap((g) => g.diagnostics)).toContain(d);
    expect(result).toEqual(before);
    expect(result.files).toEqual([]); // UI grouping cannot enable export.
  });
  it.each([
    ["en", "Logging", "20 errors across 10 services", "Show details"],
    ["ja", "ログ設定", "10 サービスで 20 件のエラー", "詳細を表示"],
  ] as const)(
    "renders accessible %s group and every original path",
    (language, label, count, details) => {
      const result = convertCompose(source);
      const html = renderToStaticMarkup(
        <DiagnosticList diagnostics={result.diagnostics} language={language} />,
      );
      expect(html).toContain("<details");
      expect(html).toContain("<summary>");
      for (const value of [label, count, details])
        expect(html).toContain(value);
      for (const diagnostic of result.diagnostics)
        expect(html).toContain(diagnostic.path);
    },
  );
  it("retains duplicate diagnostics and does not group unrelated errors", () => {
    const d = {
      severity: "error" as const,
      code: "unsupported",
      path: "$.services.web.logging.driver",
      message: "syslog",
    };
    const groups = groupDiagnostics([
      d,
      d,
      { ...d, path: "$.services.web.image" },
    ]);
    expect(groups[0]?.diagnostics).toHaveLength(2);
    expect(groups[0]?.serviceCount).toBe(1);
    expect(groups[1]?.kind).toBe("single");
  });
});
