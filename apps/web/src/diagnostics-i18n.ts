import type { Diagnostic } from "@compose2quadlet/core";
import type { Language } from "./preferences";

// Presentation-only translations. Core diagnostics and generated files stay unchanged.
const messages: Record<string, string> = {
  "Zero shm_size is not converted because Podman interprets it as unlimited. Set an explicit positive size.":
    "Podman は shm_size の 0 を無制限として扱うため、自動変換しません。正のサイズを明示してください。",
  "Expected a recognized Linux capability name or ALL, optionally prefixed with CAP_.":
    "既知の Linux capability 名または ALL を指定してください。CAP_ 接頭辞も使用できます。",
  "Expected a non-negative byte count or Compose RAM size (b, k/kb/kib, m/mb/mib, g/gb/gib, t/tb/tib, p/pb/pib), within the safe integer range.":
    "shm_size は安全な整数範囲内の非負バイト数、または Compose の RAM サイズ（b・k/kb/kib・m/mb/mib・g/gb/gib・t/tb/tib・p/pb/pib）で指定してください。",
  "Expected a logging mapping.": "logging はマッピングで指定してください。",
  "Docker syslog logging cannot be safely mapped to Podman Quadlet. The Docker daemon forwards syslog to its configured endpoint; Podman logging drivers and host/container networking differ. Migrate the log collector and logging options explicitly. No LogDriver or PodmanArgs is generated.":
    "Docker の syslog ログ転送は安全に Quadlet へ変換できません。Docker daemon からの転送と Podman のログドライバー・ホスト／コンテナのネットワークは異なります。ログ収集先と logging オプションを明示的に移行してください。LogDriver や PodmanArgs は生成しません。",
  "Logging drivers require explicit migration and are not converted.":
    "ログドライバーは自動変換しません。明示的に移行してください。",
  "Logging options are not converted. Preserve endpoint, tag and transport settings in a reviewed logging migration.":
    "logging オプションは変換しません。転送先・tag・通信方式を確認し、ログ移行時に保持してください。",
  "Logging settings require explicit migration and are not converted.":
    "logging 設定は自動変換しません。明示的に移行してください。",
  "Compose extension metadata is not emitted.":
    "Compose の拡張メタデータは出力されません。",
  "This Compose setting is not supported by the MVP. Remove it or migrate it manually.":
    "この Compose 設定は未対応です。削除するか、手動で移行してください。",
  "Expected a non-empty single-line string without control characters.":
    "制御文字を含まない、空でない 1 行の文字列を指定してください。",
  "Expected a list.": "リストを指定してください。",
  "Names must use letters, digits, underscores or hyphens, start with a letter/digit, and be at most 120 characters.":
    "名前は英数字で始まり、英数字・アンダースコア・ハイフンのみの 120 文字以内にしてください。",
  "Compose input must be at most 1 MB of text.":
    "Compose 入力は 1 MB 以内にしてください。",
  "Invalid YAML.": "YAML が正しくありません。",
  "Expected a Compose mapping.": "Compose のマッピングを指定してください。",
  "Input exceeds the supported nesting or structure size.":
    "入力の階層数または構造の大きさが上限を超えています。",
  "Compose variable interpolation requires host/.env values. Replace variables with literal values before converting.":
    "変数の展開にはホストまたは .env の値が必要です。変換前に変数を具体的な値に置き換えてください。",
  "Recursive YAML aliases are not supported.":
    "再帰的な YAML エイリアスは未対応です。",
  "The obsolete Compose version field does not affect conversion.":
    "非推奨の Compose version フィールドは変換に影響しません。",
  "At least one service mapping is required.":
    "services に 1 つ以上のサービスを指定してください。",
  "The MVP supports at most 1000 services.": "サービス数の上限は 1000 です。",
  "Expected a resource mapping.": "リソースのマッピングを指定してください。",
  "Expected a resource mapping or null.":
    "リソースのマッピングまたは null を指定してください。",
  "Only boolean external is supported.":
    "external には真偽値を指定してください。",
  "Resource name is invalid or has special meaning to Quadlet.":
    "リソース名が不正、または Quadlet で特別な意味を持つ名前です。",
  "Only the default driver is supported.": "既定の driver のみ対応しています。",
  "An external resource may not specify a driver.":
    "外部リソースには driver を指定できません。",
  "Quadlet resource names use the systemd- prefix, not Compose project-scoped names. Review existing data and network isolation.":
    "Quadlet のリソース名には systemd- 接頭辞を使用します。Compose のプロジェクト名とは異なるため、既存データとネットワークの分離を確認してください。",
  "Expected a service mapping.": "サービスのマッピングを指定してください。",
  "Duplicate generated Podman container name.":
    "生成される Podman コンテナ名が重複しています。",
  "Expected a literal container image reference.":
    "具体的なコンテナイメージ名を指定してください。",
  "Invalid container name.": "コンテナ名が正しくありません。",
  "Container working directory must be an absolute Linux path.":
    "コンテナの working_dir は Linux の絶対パスで指定してください。",
  "Scalar settings may not have surrounding whitespace or backslashes.":
    "設定値の前後の空白とバックスラッシュは使用できません。",
  "Expected user or user:group.":
    "user または user:group の形式で指定してください。",
  "Swarm ingress publishing cannot be mapped.":
    "Swarm の ingress ポート公開は変換できません。",
  "Port target/published must be strings or numbers.":
    "ポートの target と published は文字列または数値で指定してください。",
  "Expected a port string, number or mapping.":
    "ポートは文字列・数値・マッピングで指定してください。",
  "Unsupported or invalid port syntax. Use [IP:]HOST:CONTAINER[/tcp|udp] with matching valid ranges.":
    "ポートの形式が不正または未対応です。[IP:]HOST:CONTAINER[/tcp|udp] の形式で、有効かつ一致する範囲を指定してください。",
  "Expected an environment mapping or list.":
    "environment はマッピングまたはリストで指定してください。",
  "Invalid environment variable name.": "環境変数名が正しくありません。",
  "Host-inherited environment values cannot be resolved in the browser. Provide an explicit value.":
    "ホストから継承する環境変数はブラウザ内では解決できません。具体的な値を指定してください。",
  "Environment values must be scalars.":
    "環境変数の値は文字列・数値・真偽値で指定してください。",
  "Environment files must use Linux paths.":
    "環境変数ファイルには Linux のパスを使用してください。",
  "Only the filename is converted. Supply this file on the Podman host; relative paths resolve beside the Quadlet. Review Compose vs Podman env-file interpolation and quoting.":
    "ファイル名のみを変換します。Podman ホストにファイルを配置してください。相対パスは Quadlet の配置先から解決されます。Compose と Podman の変数展開・引用符の違いを確認してください。",
  "Quoted or escaped string commands require exec-array syntax for safe conversion.":
    "引用符やエスケープを含むコマンドは、配列形式で指定してください。",
  "Clearing the image CMD is not safely supported by Quadlet Exec.":
    "Quadlet の Exec ではイメージの CMD を安全に空にできません。",
  "Empty command arguments are not reliably preserved by Quadlet.":
    "空のコマンド引数は Quadlet で確実に保持できません。",
  "Compose ignores image CMD when entrypoint is overridden. Supply an explicit non-empty command to preserve this behavior.":
    "Compose は entrypoint の上書き時にイメージの CMD を無視します。同じ動作にするには、空でない command を明示してください。",
  "Anonymous mounts and Windows-style paths require manual migration.":
    "匿名マウントと Windows 形式のパスは手動で移行してください。",
  "Only ro, rw, z and Z short-mount options are supported.":
    "短い形式のマウントオプションは ro・rw・z・Z のみ対応しています。",
  "Only bind and named-volume mounts are supported.":
    "bind と名前付きボリュームのマウントのみ対応しています。",
  "Expected a boolean.": "真偽値を指定してください。",
  "Bind sources must be Linux absolute or explicit relative paths; volume sources must be declared names.":
    "bind の source は Linux の絶対パスまたは明示的な相対パス、volume の source は宣言済みの名前を指定してください。",
  "Expected a mount string or mapping.":
    "マウントは文字列またはマッピングで指定してください。",
  "Mount source and target are required.":
    "マウントには source と target が必要です。",
  "Mount paths must be Linux paths without colons.":
    "マウントにはコロンを含まない Linux パスを使用してください。",
  "Relative bind paths resolve beside the installed Quadlet. Place files there or change to an absolute host path.":
    "相対 bind パスは Quadlet の配置先から解決されます。そこにファイルを配置するか、ホストの絶対パスに変更してください。",
  "Bind sources must exist on the Podman host. Compose automatic host-path creation is not reproduced.":
    "bind の source は Podman ホストに存在する必要があります。Compose のホストパス自動作成は再現されません。",
  "Mount paths may not have surrounding whitespace or backslashes.":
    "マウントパスの前後の空白とバックスラッシュは使用できません。",
  "Network attachment options (aliases, static IPs, priorities, etc.) require manual migration.":
    "ネットワーク接続オプション（aliases・固定 IP・優先度など）は手動で移行してください。",
  "Expected a list or network mapping.":
    "ネットワークはリストまたはマッピングで指定してください。",
  "An empty network list is ambiguous. Declare at least one network.":
    "空のネットワークリストは変換できません。1 つ以上のネットワークを指定してください。",
  "Only no, always, on-failure and unless-stopped are supported.":
    "restart は no・always・on-failure・unless-stopped のみ対応しています。",
  "Restart is managed by systemd, including start-rate limits. unless-stopped maps to always; manual-stop persistence across reboot differs.":
    "再起動と起動回数の制限は systemd が管理します。unless-stopped は always に変換され、手動停止後の再起動時の動作が異なります。",
  "Expected a dependency mapping.": "依存関係のマッピングを指定してください。",
  "Healthy/completed dependency conditions cannot be mapped to startup ordering.":
    "正常性や完了を待つ依存条件は、起動順序に変換できません。",
  "Optional dependencies are not supported.": "任意の依存関係は未対応です。",
  "Dependency restart propagation is not supported.":
    "依存先からの再起動の伝播は未対応です。",
  "Expected a dependency list or mapping.":
    "依存関係はリストまたはマッピングで指定してください。",
  "Requires/After provides startup ordering, not application readiness. systemd dependency stop/failure behavior differs from Compose.":
    "Requires/After は起動順序を設定しますが、アプリケーションの準備完了は待ちません。依存先の停止・失敗時の動作も Compose と異なります。",
  "Dependency cycle detected.": "依存関係が循環しています。",
};

export function diagnosticMessage(
  diagnostic: Diagnostic,
  language: Language,
): string {
  const message = diagnostic.message;
  if (language === "en") return message;
  if (messages[message]) return messages[message];
  const external =
    /^External (network|volume) (.+) must already exist on the Podman host\.$/.exec(
      message,
    );
  if (external)
    return `外部 ${external[1]} ${external[2]} は Podman ホストに存在する必要があります。`;
  const reference =
    /^(?:Named volume|Network) (.+) (?:must be declared in top-level volumes|is not declared)\.$/.exec(
      message,
    );
  if (reference)
    return `${reference[1]} が宣言されていません。トップレベルの volumes または networks を確認してください。`;
  const dependency = /^Invalid dependency (.+)\.$/.exec(message);
  if (dependency) return `依存先 ${dependency[1]} が正しくありません。`;
  const collision =
    /^Generated systemd unit name (.+) collides with another resource\.$/.exec(
      message,
    );
  if (collision)
    return `生成される systemd ユニット名 ${collision[1]} が別のリソースと重複しています。`;
  // YAML parser details and future diagnostics remain available verbatim, never omitted.
  return diagnostic.code === "invalid-yaml" ||
    diagnostic.code === "yaml-warning"
    ? `YAML を確認してください：${message}`
    : message;
}
