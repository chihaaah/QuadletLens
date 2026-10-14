import { strToU8, zipSync } from "fflate";
import type { GeneratedFile } from "@compose2quadlet/core";

export function makeArchive(files: GeneratedFile[]): Uint8Array {
  return zipSync(
    Object.fromEntries(
      files.map((file) => [file.filename, strToU8(file.content)]),
    ),
  );
}

export function download(
  filename: string,
  content: BlobPart,
  type = "text/plain;charset=utf-8",
): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
