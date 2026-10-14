import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { convertCompose } from "../packages/core/src/index";
import { makeArchive } from "../apps/web/src/download";

describe("browser ZIP export", () => {
  it("preserves every generated filename and UTF-8 content", () => {
    const files = convertCompose(
      'services:\n  web:\n    image: nginx\n    environment: {GREETING: "こんにちは"}\n',
    ).files;
    const archive = unzipSync(makeArchive(files));
    expect(Object.keys(archive).sort()).toEqual(
      files.map((f) => f.filename).sort(),
    );
    for (const file of files)
      expect(strFromU8(archive[file.filename]!)).toBe(file.content);
  });
});
