import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {
  browserLanguage,
  readPreference,
  savePreference,
  preferenceKeys,
} from "../apps/web/src/preferences";
import { translate } from "../apps/web/src/i18n";
import { diagnosticMessage } from "../apps/web/src/diagnostics-i18n";
import { convertCompose } from "../packages/core/src/index";

describe("local UI preferences", () => {
  const prepaint = readFileSync(
    new URL("../apps/web/index.html", import.meta.url), "utf8",
  ).match(/<script>([\s\S]*?)<\/script>/)?.[1];

  it.each([
    ["legacy only", { "compose2quadlet.theme": "dark", "compose2quadlet.language": "ja" }, "dark", "ja"],
    ["new overrides legacy", { "quadletlens.theme": "light", "quadletlens.language": "en", "compose2quadlet.theme": "dark", "compose2quadlet.language": "ja" }, "light", "en"],
    ["invalid new falls back", { "quadletlens.theme": "invalid", "quadletlens.language": "invalid", "compose2quadlet.theme": "dark", "compose2quadlet.language": "ja" }, "dark", "ja"],
    ["invalid legacy uses defaults", { "compose2quadlet.theme": "invalid", "compose2quadlet.language": "invalid" }, "light", "en"],
    ["no preferences", {}, "light", "en"],
  ] as const)("keeps React and pre-paint resolution equivalent: %s", (_name, values, theme, language) => {
    const local = { getItem: (key: string) => new Map<string, string>(Object.entries(values)).get(key) ?? null };
    expect(readPreference(local, preferenceKeys.theme, ["light", "dark"]) ?? "light").toBe(theme);
    expect(readPreference(local, preferenceKeys.language, ["en", "ja"]) ?? "en").toBe(language);
    const root = { dataset: {}, lang: "" };
    expect(prepaint).toBeDefined();
    runInNewContext(prepaint!, {
      localStorage: local,
      document: { documentElement: root },
      matchMedia: () => ({ matches: false }),
      navigator: { language: "en-US" },
    });
    expect(root).toEqual({ dataset: { theme }, lang: language });
  });

  it("writes only new keys while leaving legacy values intact", () => {
    const values = new Map([["compose2quadlet.theme", "dark"]]);
    const local = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    savePreference(local, preferenceKeys.theme, "light");
    savePreference(local, preferenceKeys.language, "en");
    expect([...values]).toEqual([
      ["compose2quadlet.theme", "dark"],
      ["quadletlens.theme", "light"],
      ["quadletlens.language", "en"],
    ]);
  });

  it("uses browser defaults before paint when storage access throws", () => {
    const root = { dataset: {}, lang: "" };
    runInNewContext(prepaint!, {
      get localStorage() { throw new Error("blocked"); },
      document: { documentElement: root },
      matchMedia: () => ({ matches: true }),
      navigator: { language: "ja-JP" },
    });
    expect(root).toEqual({ dataset: { theme: "dark" }, lang: "ja" });
  });
  it.each([
    ["ja-JP", "ja"],
    ["JA", "ja"],
    ["en-US", "en"],
    ["fr-FR", "en"],
    ["javanese", "en"],
  ])("uses browser locale %s as %s", (locale, expected) =>
    expect(browserLanguage(locale)).toBe(expected),
  );
  it("persists only explicit preferences and ignores unknown stored values", () => {
    const values = new Map<string, string>();
    const local = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    expect(readPreference(local, "theme", ["light", "dark"])).toBeUndefined();
    savePreference(local, "theme", "dark");
    expect(readPreference(local, "theme", ["light", "dark"])).toBe("dark");
    savePreference(local, "theme", "invalid");
    expect(readPreference(local, "theme", ["light", "dark"])).toBeUndefined();
  });
  it("survives disabled storage", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readPreference(blocked, "theme", ["light", "dark"])).toBeUndefined();
    expect(() => savePreference(blocked, "language", "ja")).not.toThrow();
  });
  it("translates status placeholders literally without changing technical filenames", () => {
    expect(translate("ja", "copied", { filename: "web.container" })).toBe(
      "web.container をコピーしました。",
    );
    expect(translate("en", "loaded", { filename: "$&.yaml" })).toBe(
      "Loaded $&.yaml. Select Convert.",
    );
  });
  it("localizes diagnostic presentation without mutating converter output", () => {
    const result = convertCompose(
      "services: {web: {image: nginx, privileged: true}}",
    );
    const original = structuredClone(result);
    const unsupported = result.diagnostics.find(
      (d) => d.code === "unsupported",
    )!;
    expect(diagnosticMessage(unsupported, "ja")).toContain("未対応");
    expect(diagnosticMessage(unsupported, "en")).toBe(unsupported.message);
    expect(result).toEqual(original);
    expect(
      diagnosticMessage(
        {
          severity: "error",
          code: "future-code",
          path: "$",
          message: "Future diagnostic details",
        },
        "ja",
      ),
    ).toBe("Future diagnostic details");
  });
});
