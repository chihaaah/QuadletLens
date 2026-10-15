import type { ConversionResult } from "@compose2quadlet/core";
import { canExport } from "./export-safety";
import { translate } from "./i18n";
import type { Language } from "./preferences";
import { Icon } from "./Icon";

export function ExportActions({
  result,
  dirty,
  selected,
  language,
  onCopy,
  onDownload,
  onZip,
}: {
  result: ConversionResult;
  dirty: boolean;
  selected: string | undefined;
  language: Language;
  onCopy: () => void;
  onDownload: () => void;
  onZip: () => void;
}) {
  const enabled = canExport(result, dirty);
  const selectedExportable =
    enabled && result.files.some((file) => file.filename === selected);
  const t = (key: "copy" | "download" | "downloadAll") =>
    translate(language, key);
  return (
    <div className="pane-footer export-actions">
      <button disabled={!selectedExportable} onClick={onCopy}>
        <Icon name="copy" />
        {t("copy")}
      </button>
      <button disabled={!selectedExportable} onClick={onDownload}>
        <Icon name="download" />
        {t("download")}
      </button>
      <button disabled={!enabled} onClick={onZip}>
        {t("downloadAll")} <span className="zip-label">ZIP</span>
      </button>
    </div>
  );
}
