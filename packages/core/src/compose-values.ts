// Linux capabilities through CAP_CHECKPOINT_RESTORE. Unknown names fail closed.
const capabilities = new Set(
  `CHOWN DAC_OVERRIDE DAC_READ_SEARCH FOWNER FSETID KILL
SETGID SETUID SETPCAP LINUX_IMMUTABLE NET_BIND_SERVICE NET_BROADCAST NET_ADMIN NET_RAW
IPC_LOCK IPC_OWNER SYS_MODULE SYS_RAWIO SYS_CHROOT SYS_PTRACE SYS_PACCT SYS_ADMIN
SYS_BOOT SYS_NICE SYS_RESOURCE SYS_TIME SYS_TTY_CONFIG MKNOD LEASE AUDIT_WRITE
AUDIT_CONTROL SETFCAP MAC_OVERRIDE MAC_ADMIN SYSLOG WAKE_ALARM BLOCK_SUSPEND
AUDIT_READ PERFMON BPF CHECKPOINT_RESTORE ALL`.split(/\s+/),
);

export function normalizeCapability(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  // Podman accepts names with or without CAP_. Do not accept whitespace or flags.
  const name = value.toUpperCase().replace(/^CAP_/, "");
  return capabilities.has(name) ? name : undefined;
}

/** Compose RAM units are binary, including 'mb'/'gb'. Emit explicit bytes for Quadlet. */
export function normalizeShmSize(value: unknown): string | undefined {
  if (typeof value === "number")
    return Number.isSafeInteger(value) && value >= 0
      ? String(value)
      : undefined;
  if (typeof value !== "string" || value.length > 100) return;
  const match = /^(\d+)(?:\.(\d+))?(?: ?([bkmgpt](?:i?b)?))?$/i.exec(value);
  if (!match) return;
  const whole = match[1]!;
  const fraction = match[2] ?? "";
  const suffix = (match[3] ?? "b").toLowerCase();
  const power = "bkmgtp".indexOf(suffix[0]!);
  if (power < 0 || (suffix[0] === "b" && suffix !== "b")) return;
  const scale = 10n ** BigInt(fraction.length);
  const bytes = (BigInt(whole + fraction) * 1024n ** BigInt(power)) / scale;
  return bytes <= BigInt(Number.MAX_SAFE_INTEGER)
    ? bytes.toString()
    : undefined;
}
