// src/lib/security-log.ts
type SecurityLogLevel = "warn" | "error" | "info";

type SecurityLogMeta = Record<string, unknown>;

function safeMeta(meta: SecurityLogMeta = {}) {
  const out: SecurityLogMeta = {};

  for (const [key, value] of Object.entries(meta)) {
    if (value instanceof Error) {
      out[key] = {
        name: value.name,
        message: value.message,
      };
      continue;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      out[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      out[key] = value.slice(0, 20);
      continue;
    }

    if (typeof value === "object") {
      out[key] = "[object]";
      continue;
    }

    out[key] = String(value);
  }

  return out;
}

export function logSecurity(
  event: string,
  meta: SecurityLogMeta = {},
  level: SecurityLogLevel = "warn",
) {
  const payload = {
    level,
    type: "security",
    event,
    at: new Date().toISOString(),
    ...safeMeta(meta),
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "info") {
    console.info(line);
    return;
  }

  console.warn(line);
}