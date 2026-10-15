import { normalizeCapability, normalizeShmSize } from "./compose-values.js";

import type { GeneratedFile, Diagnostic } from "./types.js";
import type { ParsedCompose } from "./parser.js";
interface Plan {
  files: GeneratedFile[];
  diagnostics: Diagnostic[];
}
type Dict = Record<string, unknown>;
const record = (value: unknown): value is Dict =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const owns = (value: Dict, key: string) => Object.hasOwn(value, key);
const entries = (value: Dict) =>
  Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
const namePattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const scalar = (v: unknown): v is string | number | boolean =>
  typeof v === "string" ||
  typeof v === "boolean" ||
  (typeof v === "number" && Number.isFinite(v));
// Quadlet parses systemd words. Quote each argument and escape literal specifiers.
const raw = (value: string) =>
  value.replaceAll("%", "%%").replaceAll("$", () => "$$");
const word = (value: string) => JSON.stringify(raw(value));
const file = (
  filename: string,
  sections: [string, string[]][],
): GeneratedFile => ({
  filename,
  content:
    sections
      .filter(([, lines]) => lines.length)
      .map(([name, lines]) => `[${name}]\n${lines.join("\n")}`)
      .join("\n\n") + "\n",
});

/** Validated mapping plan; candidates remain private until the export safety gate. */
export function planCompose(parsed: ParsedCompose): Plan {
  const diagnostics: Diagnostic[] = [...parsed.diagnostics];
  const files: GeneratedFile[] = [];
  const add = (
    severity: Diagnostic["severity"],
    code: string,
    path: string,
    message: string,
  ) => diagnostics.push({ severity, code, path, message });
  const error = (path: string, message: string, code = "unsupported") =>
    add("error", code, path, message);
  const warn = (path: string, message: string, code = "review-required") =>
    add("warning", code, path, message);
  const unknown = (obj: Dict, allowed: string[], path: string) => {
    for (const [key] of entries(obj))
      if (!allowed.includes(key)) {
        if (key.startsWith("x-"))
          add(
            "info",
            "extension",
            `${path}.${key}`,
            "Compose extension metadata is not emitted.",
          );
        else
          error(
            `${path}.${key}`,
            "This Compose setting is not supported by the MVP. Remove it or migrate it manually.",
          );
      }
  };
  const text = (
    value: unknown,
    path: string,
    empty = false,
  ): string | undefined => {
    if (
      typeof value !== "string" ||
      (!empty && value.length === 0) ||
      /[\x00-\x1f\x7f]/.test(value)
    ) {
      error(
        path,
        "Expected a non-empty single-line string without control characters.",
        "invalid-value",
      );
      return;
    }
    return value;
  };
  const list = (value: unknown, path: string): unknown[] => {
    if (!Array.isArray(value)) {
      error(path, "Expected a list.", "invalid-value");
      return [];
    }
    return value;
  };
  const validName = (value: string, path: string) => {
    if (!namePattern.test(value) || value.length > 120) {
      error(
        path,
        "Names must use letters, digits, underscores or hyphens, start with a letter/digit, and be at most 120 characters.",
        "invalid-name",
      );
      return false;
    }
    return true;
  };
  const root = parsed.root;
  if (!record(root)) return { files: [], diagnostics };
  unknown(root, ["services", "networks", "volumes", "version"], "$");
  if (owns(root, "version"))
    add(
      "info",
      "obsolete-version",
      "$.version",
      "The obsolete Compose version field does not affect conversion.",
    );
  if (!record(root.services) || !Object.keys(root.services).length) {
    error(
      "$.services",
      "At least one service mapping is required.",
      "invalid-compose",
    );
    return { files: [], diagnostics };
  }
  const services = root.services;
  if (Object.keys(services).length > 1000) {
    error(
      "$.services",
      "The MVP supports at most 1000 services.",
      "input-limit",
    );
    return { files: [], diagnostics };
  }
  const resourceMap = (value: unknown, path: string) => {
    if (value === undefined) return {};
    if (!record(value)) {
      error(path, "Expected a resource mapping.", "invalid-value");
      return {};
    }
    return value;
  };
  const networks = resourceMap(root.networks, "$.networks");
  const volumes = resourceMap(root.volumes, "$.volumes");
  if (
    Object.values(services).some(
      (s) => record(s) && (!owns(s, "networks") || s.networks === null),
    )
  ) {
    if (!owns(networks, "default")) networks.default = {};
  }
  const unitNames = new Set<string>();
  const reserve = (name: string, path: string) => {
    if (unitNames.has(name))
      error(
        path,
        `Generated systemd unit name ${name} collides with another resource.`,
        "name-collision",
      );
    unitNames.add(name);
  };
  const refs: Record<"network" | "volume", Map<string, string>> = {
    network: new Map(),
    volume: new Map(),
  };
  for (const [kind, resources] of [
    ["network", networks],
    ["volume", volumes],
  ] as const) {
    for (const [key, value] of entries(resources)) {
      const path = `$.${kind}s.${key}`;
      if (!validName(key, path)) continue;
      const config = value === null ? {} : value;
      if (!record(config)) {
        error(path, "Expected a resource mapping or null.", "invalid-value");
        continue;
      }
      unknown(config, ["name", "external", "driver"], path);
      if (owns(config, "external") && typeof config.external !== "boolean")
        error(
          `${path}.external`,
          "Only boolean external is supported.",
          "invalid-value",
        );
      const external = config.external === true;
      const explicit = owns(config, "name")
        ? text(config.name, `${path}.name`)
        : undefined;
      const effectiveResourceName = explicit ?? (external ? key : undefined);
      if (
        effectiveResourceName &&
        (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(effectiveResourceName) ||
          effectiveResourceName.endsWith("." + kind) ||
          (kind === "network" &&
            [
              "host",
              "none",
              "bridge",
              "private",
              "pasta",
              "slirp4netns",
            ].includes(effectiveResourceName)))
      ) {
        error(
          `${path}.name`,
          "Resource name is invalid or has special meaning to Quadlet.",
          "invalid-name",
        );
      }
      if (
        owns(config, "driver") &&
        config.driver !== (kind === "network" ? "bridge" : "local")
      )
        error(`${path}.driver`, "Only the default driver is supported.");
      if (external) {
        if (owns(config, "driver"))
          error(
            `${path}.driver`,
            "An external resource may not specify a driver.",
            "invalid-value",
          );
        refs[kind].set(key, explicit ?? key);
        warn(
          path,
          `External ${kind} ${explicit ?? key} must already exist on the Podman host.`,
        );
      } else {
        const filename = `${kind}-${key}.${kind}`;
        reserve(`${kind}-${key}-${kind}.service`, path);
        refs[kind].set(key, filename);
        files.push(
          file(filename, [
            [
              kind === "network" ? "Network" : "Volume",
              explicit
                ? [
                    `${kind === "network" ? "NetworkName" : "VolumeName"}=${raw(explicit)}`,
                  ]
                : ["# Quadlet uses its systemd- prefixed resource name."],
            ],
          ]),
        );
        if (!explicit)
          warn(
            path,
            "Quadlet resource names use the systemd- prefix, not Compose project-scoped names. Review existing data and network isolation.",
          );
      }
    }
  }
  const dependencyGraph = new Map<string, string[]>();
  const containerNames = new Set<string>();
  for (const [name, value] of entries(services)) {
    const path = `$.services.${name}`;
    if (!validName(name, path)) continue;
    reserve(`${name}.service`, path);
    if (!record(value)) {
      error(path, "Expected a service mapping.", "invalid-value");
      continue;
    }
    const s = value;
    const effectiveName =
      typeof s.container_name === "string"
        ? s.container_name
        : `systemd-${name}`;
    if (containerNames.has(effectiveName))
      error(
        `${path}.container_name`,
        "Duplicate generated Podman container name.",
        "name-collision",
      );
    containerNames.add(effectiveName);
    unknown(
      s,
      [
        "image",
        "container_name",
        "ports",
        "environment",
        "env_file",
        "volumes",
        "networks",
        "command",
        "entrypoint",
        "user",
        "working_dir",
        "restart",
        "depends_on",
        "cap_add",
        "cap_drop",
        "shm_size",
        "logging",
      ],
      path,
    );
    const container: string[] = [];
    const unit: string[] = [`Description=Compose service ${name}`];
    const service: string[] = [];
    for (const [key, directive] of [
      ["cap_add", "AddCapability"],
      ["cap_drop", "DropCapability"],
    ] as const) {
      if (!owns(s, key)) continue;
      for (const [i, capability] of list(s[key], `${path}.${key}`).entries()) {
        const normalized = normalizeCapability(capability);
        if (normalized === undefined)
          error(
            `${path}.${key}[${i}]`,
            "Expected a recognized Linux capability name or ALL, optionally prefixed with CAP_.",
            "invalid-value",
          );
        else container.push(`${directive}=${normalized}`);
      }
    }
    if (owns(s, "shm_size")) {
      const bytes = normalizeShmSize(s.shm_size);
      if (bytes === undefined)
        error(
          `${path}.shm_size`,
          "Expected a non-negative byte count or Compose RAM size (b, k/kb/kib, m/mb/mib, g/gb/gib, t/tb/tib, p/pb/pib), within the safe integer range.",
          "invalid-value",
        );
      else if (bytes === "0")
        error(
          `${path}.shm_size`,
          "Zero shm_size is not converted because Podman interprets it as unlimited. Set an explicit positive size.",
        );
      else container.push(`ShmSize=${bytes}`);
    }
    if (owns(s, "logging")) {
      const loggingError = (
        path: string,
        message: string,
        code = "unsupported",
      ) => {
        add("error", code, path, message);
        const diagnostic = diagnostics.at(-1);
        if (diagnostic)
          diagnostic.migration = {
            feature: "logging",
            previewOmission: code === "unsupported",
          };
      };
      if (!record(s.logging))
        loggingError(
          `${path}.logging`,
          "Expected a logging mapping.",
          "invalid-value",
        );
      else {
        unknown(s.logging, ["driver", "options"], `${path}.logging`);
        if (s.logging.driver === "syslog") {
          loggingError(
            `${path}.logging.driver`,
            "Docker syslog logging cannot be safely mapped to Podman Quadlet. The Docker daemon forwards syslog to its configured endpoint; Podman logging drivers and host/container networking differ. Migrate the log collector and logging options explicitly. No LogDriver or PodmanArgs is generated.",
            "unsupported",
          );
        } else if (owns(s.logging, "driver"))
          loggingError(
            `${path}.logging.driver`,
            "Logging drivers require explicit migration and are not converted.",
          );
        if (owns(s.logging, "options"))
          loggingError(
            `${path}.logging.options`,
            "Logging options are not converted. Preserve endpoint, tag and transport settings in a reviewed logging migration.",
          );
        if (!owns(s.logging, "driver") && !owns(s.logging, "options"))
          loggingError(
            `${path}.logging`,
            "Logging settings require explicit migration and are not converted.",
          );
      }
    }
    const image = text(s.image, `${path}.image`);
    if (image) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._/:@-]*$/.test(image))
        error(
          `${path}.image`,
          "Expected a literal container image reference.",
          "invalid-value",
        );
      container.push(`Image=${raw(image)}`);
    }
    for (const [key, quadlet] of [
      ["container_name", "ContainerName"],
      ["user", "User"],
      ["working_dir", "WorkingDir"],
    ] as const) {
      if (!owns(s, key)) continue;
      const v =
        key === "user" && typeof s[key] === "number"
          ? String(s[key])
          : text(s[key], `${path}.${key}`);
      if (v === undefined) continue;
      if (key === "container_name") {
        if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(v))
          error(`${path}.${key}`, "Invalid container name.", "invalid-name");
      }
      if (key === "working_dir" && !v.startsWith("/"))
        error(
          `${path}.${key}`,
          "Container working directory must be an absolute Linux path.",
          "invalid-value",
        );
      if (v.trim() !== v || v.includes("\\"))
        error(
          `${path}.${key}`,
          "Scalar settings may not have surrounding whitespace or backslashes.",
          "invalid-value",
        );
      if (key === "user" && !/^[a-zA-Z0-9_.-]+(?::[a-zA-Z0-9_.-]+)?$/.test(v))
        error(
          `${path}.${key}`,
          "Expected user or user:group.",
          "invalid-value",
        );
      // These Quadlet keys are scalar strings, not word lists.
      container.push(`${quadlet}=${raw(v)}`);
    }
    if (owns(s, "ports"))
      for (const [i, port] of list(s.ports, `${path}.ports`).entries()) {
        const p = `${path}.ports[${i}]`;
        let spec: string | undefined;
        if (typeof port === "string" || typeof port === "number")
          spec = String(port);
        else if (record(port)) {
          unknown(
            port,
            ["target", "published", "host_ip", "protocol", "mode"],
            p,
          );
          if (owns(port, "mode") && port.mode !== "host")
            error(`${p}.mode`, "Swarm ingress publishing cannot be mapped.");
          if (
            !scalar(port.target) ||
            (owns(port, "published") && !scalar(port.published))
          )
            error(
              p,
              "Port target/published must be strings or numbers.",
              "invalid-value",
            );
          else {
            const host = owns(port, "host_ip")
              ? text(port.host_ip, `${p}.host_ip`)
              : undefined;
            const ip =
              host?.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
            spec = `${ip ? ip + ":" : ""}${owns(port, "published") ? String(port.published) + ":" : ip ? ":" : ""}${String(port.target)}${owns(port, "protocol") ? "/" + String(port.protocol) : ""}`;
          }
        } else
          error(
            p,
            "Expected a port string, number or mapping.",
            "invalid-value",
          );
        if (spec) {
          const match =
            /^(?:(?:\[[0-9a-fA-F:]+\]|(?:\d{1,3}\.){3}\d{1,3}):)?(?:(\d+(?:-\d+)?):)?(\d+(?:-\d+)?)(?:\/(tcp|udp))?$/.exec(
              spec,
            );
          const ranges = match
            ? [match[1], match[2]]
                .filter((v): v is string => v !== undefined)
                .map((v) => v.split("-").map(Number))
            : [];
          const ipv4 = /^((?:\d{1,3}\.){3}\d{1,3}):/.exec(spec)?.[1];
          if (
            !match ||
            (ipv4 && ipv4.split(".").some((n) => Number(n) > 255)) ||
            ranges.some(
              (r) =>
                r.some((n) => n < 1 || n > 65535) ||
                (r.length === 2 && r[0]! > r[1]!),
            ) ||
            (ranges.length === 2 &&
              (ranges[0]![1] ?? ranges[0]![0]!) - ranges[0]![0]! !==
                (ranges[1]![1] ?? ranges[1]![0]!) - ranges[1]![0]!)
          )
            error(
              p,
              "Unsupported or invalid port syntax. Use [IP:]HOST:CONTAINER[/tcp|udp] with matching valid ranges.",
              "invalid-value",
            );
          else container.push(`PublishPort=${spec}`);
        }
      }
    if (owns(s, "environment")) {
      const env = s.environment;
      const values: [string, unknown, string][] = [];
      if (record(env))
        for (const [key, v] of entries(env))
          values.push([key, v, `${path}.environment.${key}`]);
      else if (Array.isArray(env))
        for (const [i, v] of env.entries()) {
          const p = `${path}.environment[${i}]`;
          const item = text(v, p);
          if (!item) continue;
          const split = item.indexOf("=");
          values.push(
            split < 0
              ? [item, null, p]
              : [item.slice(0, split), item.slice(split + 1), p],
          );
        }
      else
        error(
          `${path}.environment`,
          "Expected an environment mapping or list.",
          "invalid-value",
        );
      for (const [key, v, p] of values) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
          error(p, "Invalid environment variable name.", "invalid-value");
          continue;
        }
        if (v === null) {
          error(
            p,
            "Host-inherited environment values cannot be resolved in the browser. Provide an explicit value.",
          );
          continue;
        }
        if (!scalar(v)) {
          error(p, "Environment values must be scalars.", "invalid-value");
          continue;
        }
        const str = text(String(v), p, true);
        if (str !== undefined)
          container.push(`Environment=${word(`${key}=${str}`)}`);
      }
    }
    if (owns(s, "env_file")) {
      const envFiles =
        typeof s.env_file === "string"
          ? [s.env_file]
          : list(s.env_file, `${path}.env_file`);
      for (const [i, v] of envFiles.entries()) {
        const p = `${path}.env_file[${i}]`;
        const vtext = text(v, p);
        if (vtext) {
          if (vtext.includes("\\") || /^[a-zA-Z]:/.test(vtext))
            error(
              p,
              "Environment files must use Linux paths.",
              "invalid-value",
            );
          container.push(
            `EnvironmentFile=${word(vtext.startsWith("/") || vtext.startsWith(".") ? vtext : "./" + vtext)}`,
          );
          warn(
            p,
            "Only the filename is converted. Supply this file on the Podman host; relative paths resolve beside the Quadlet. Review Compose vs Podman env-file interpolation and quoting.",
          );
        }
      }
    }
    for (const key of ["command", "entrypoint"] as const)
      if (owns(s, key) && s[key] !== null) {
        const p = `${path}.${key}`;
        const v = s[key];
        let args: string[] = [];
        if (Array.isArray(v))
          args = v.map((arg, i) => text(arg, `${p}[${i}]`, true) ?? "");
        else {
          const str = text(v, p, true);
          if (str !== undefined) {
            // Deliberately accept only unambiguous string form; use exec arrays for quoting.
            if (/["'\\]/.test(str))
              error(
                p,
                "Quoted or escaped string commands require exec-array syntax for safe conversion.",
              );
            else args = str.trim() ? str.trim().split(/ +/) : [];
          }
        }
        if (!args.length && key === "command")
          error(
            p,
            "Clearing the image CMD is not safely supported by Quadlet Exec.",
          );
        else if (args.some((arg) => arg.length === 0))
          error(
            p,
            "Empty command arguments are not reliably preserved by Quadlet.",
          );
        else if (key === "entrypoint") {
          container.push(`Entrypoint=${raw(JSON.stringify(args))}`);
          if (s.command === undefined || s.command === null)
            error(
              p,
              "Compose ignores image CMD when entrypoint is overridden. Supply an explicit non-empty command to preserve this behavior.",
            );
        } else container.push(`Exec=${args.map(word).join(" ")}`);
      }
    if (owns(s, "volumes"))
      for (const [i, v] of list(s.volumes, `${path}.volumes`).entries()) {
        const p = `${path}.volumes[${i}]`;
        let source: string | undefined;
        let target: string | undefined;
        let options = "";
        if (typeof v === "string") {
          const parts = v.split(":");
          if (parts.length < 2 || parts.length > 3) {
            error(
              p,
              "Anonymous mounts and Windows-style paths require manual migration.",
            );
            continue;
          }
          [source, target, options = ""] = parts;
          if (!/^(?:(?:ro|rw|z|Z)(?:,(?:ro|rw|z|Z))*)?$/.test(options))
            error(p, "Only ro, rw, z and Z short-mount options are supported.");
        } else if (record(v)) {
          unknown(v, ["type", "source", "target", "read_only"], p);
          if (!["bind", "volume"].includes(String(v.type)))
            error(
              `${p}.type`,
              "Only bind and named-volume mounts are supported.",
            );
          source = text(v.source, `${p}.source`);
          target = text(v.target, `${p}.target`);
          if (owns(v, "read_only") && typeof v.read_only !== "boolean")
            error(`${p}.read_only`, "Expected a boolean.", "invalid-value");
          options = v.read_only === true ? "ro" : "";
          if (
            source &&
            (v.type === "bind") !==
              (source.startsWith("/") || source.startsWith("."))
          )
            error(
              `${p}.source`,
              "Bind sources must be Linux absolute or explicit relative paths; volume sources must be declared names.",
              "invalid-value",
            );
        } else error(p, "Expected a mount string or mapping.", "invalid-value");
        if (!source || !target) {
          error(p, "Mount source and target are required.", "invalid-value");
          continue;
        }
        if (text(source, p) === undefined || text(target, p) === undefined)
          continue;
        if (
          !target.startsWith("/") ||
          target.includes(":") ||
          source.includes(":") ||
          source.includes("\\")
        ) {
          error(
            p,
            "Mount paths must be Linux paths without colons.",
            "invalid-value",
          );
          continue;
        }
        if (source.startsWith("."))
          warn(
            p,
            "Relative bind paths resolve beside the installed Quadlet. Place files there or change to an absolute host path.",
          );
        if (source.startsWith("/") || source.startsWith("."))
          warn(
            p,
            "Bind sources must exist on the Podman host. Compose automatic host-path creation is not reproduced.",
          );
        if (!source.startsWith("/") && !source.startsWith(".")) {
          const ref = refs.volume.get(source);
          if (!ref) {
            error(
              p,
              `Named volume ${source} must be declared in top-level volumes.`,
              "missing-reference",
            );
            continue;
          }
          source = ref;
        }
        if (
          source.trim() !== source ||
          target.trim() !== target ||
          target.includes("\\")
        )
          error(
            p,
            "Mount paths may not have surrounding whitespace or backslashes.",
            "invalid-value",
          );
        // Volume is a raw scalar in Quadlet, not a shell word list: quotes become path characters.
        container.push(
          `Volume=${raw(`${source}:${target}${options ? ":" + options : ""}`)}`,
        );
      }
    let memberships: string[] = [];
    if (!owns(s, "networks") || s.networks === null) memberships = ["default"];
    else if (Array.isArray(s.networks))
      memberships = s.networks.map(
        (v, i) => text(v, `${path}.networks[${i}]`) ?? "",
      );
    else if (record(s.networks)) {
      for (const [key, config] of entries(s.networks)) {
        memberships.push(key);
        if (
          config !== null &&
          (!record(config) || Object.keys(config).length > 0)
        )
          error(
            `${path}.networks.${key}`,
            "Network attachment options (aliases, static IPs, priorities, etc.) require manual migration.",
          );
      }
    } else
      error(
        `${path}.networks`,
        "Expected a list or network mapping.",
        "invalid-value",
      );
    if (!memberships.length)
      error(
        `${path}.networks`,
        "An empty network list is ambiguous. Declare at least one network.",
      );
    for (const network of [...new Set(memberships)].sort()) {
      const ref = refs.network.get(network);
      if (!ref)
        error(
          `${path}.networks`,
          `Network ${network} is not declared.`,
          "missing-reference",
        );
      else container.push(`Network=${ref}`);
    }
    container.push(`NetworkAlias=${name}`);
    if (owns(s, "restart")) {
      const mapped: Record<string, string> = {
        no: "no",
        always: "always",
        "on-failure": "on-failure",
        "unless-stopped": "always",
      };
      const policy =
        typeof s.restart === "string" ? mapped[s.restart] : undefined;
      if (!policy)
        error(
          `${path}.restart`,
          "Only no, always, on-failure and unless-stopped are supported.",
        );
      else {
        service.push(`Restart=${policy}`);
        if (s.restart !== "no")
          warn(
            `${path}.restart`,
            "Restart is managed by systemd, including start-rate limits. unless-stopped maps to always; manual-stop persistence across reboot differs.",
          );
      }
    }
    const deps: string[] = [];
    if (owns(s, "depends_on")) {
      if (Array.isArray(s.depends_on))
        for (const [i, d] of s.depends_on.entries()) {
          const name = text(d, `${path}.depends_on[${i}]`);
          if (name) deps.push(name);
        }
      else if (record(s.depends_on))
        for (const [name, config] of entries(s.depends_on)) {
          deps.push(name);
          if (!record(config))
            error(
              `${path}.depends_on.${name}`,
              "Expected a dependency mapping.",
              "invalid-value",
            );
          else {
            unknown(
              config,
              ["condition", "required", "restart"],
              `${path}.depends_on.${name}`,
            );
            if (
              owns(config, "condition") &&
              config.condition !== "service_started"
            )
              error(
                `${path}.depends_on.${name}.condition`,
                "Healthy/completed dependency conditions cannot be mapped to startup ordering.",
              );
            if (owns(config, "required") && config.required !== true)
              error(
                `${path}.depends_on.${name}.required`,
                "Optional dependencies are not supported.",
              );
            if (owns(config, "restart") && config.restart !== false)
              error(
                `${path}.depends_on.${name}.restart`,
                "Dependency restart propagation is not supported.",
              );
          }
        }
      else
        error(
          `${path}.depends_on`,
          "Expected a dependency list or mapping.",
          "invalid-value",
        );
      for (const dep of [...new Set(deps)].sort()) {
        if (
          !owns(services, dep) ||
          dep === name ||
          !validName(dep, `${path}.depends_on`)
        )
          error(
            `${path}.depends_on`,
            `Invalid dependency ${dep}.`,
            "missing-reference",
          );
        else {
          unit.push(`Requires=${dep}.service`, `After=${dep}.service`);
        }
      }
      if (deps.length)
        warn(
          `${path}.depends_on`,
          "Requires/After provides startup ordering, not application readiness. systemd dependency stop/failure behavior differs from Compose.",
        );
    }
    dependencyGraph.set(name, deps);
    files.push(
      file(`${name}.container`, [
        ["Unit", unit],
        ["Container", container],
        ["Service", service],
        ["Install", ["WantedBy=default.target"]],
      ]),
    );
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (name: string): void => {
    if (visiting.has(name)) {
      error(
        `$.services.${name}.depends_on`,
        "Dependency cycle detected.",
        "dependency-cycle",
      );
      return;
    }
    if (visited.has(name)) return;
    visiting.add(name);
    for (const dep of dependencyGraph.get(name) ?? []) visit(dep);
    visiting.delete(name);
    visited.add(name);
  };
  for (const name of dependencyGraph.keys()) visit(name);
  return {
    files: files.sort((a, b) =>
      a.filename < b.filename ? -1 : a.filename > b.filename ? 1 : 0,
    ),
    diagnostics,
  };
}
