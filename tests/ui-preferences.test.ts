import { describe, expect, it } from "vitest";
import {
  browserLanguage,
  readPreference,
  savePreference,
} from "../apps/web/src/preferences";
import { translate } from "../apps/web/src/i18n";
import { diagnosticMessage } from "../apps/web/src/diagnostics-i18n";
import { convertCompose } from "../packages/core/src/index";

describe("local UI preferences", () => {
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
