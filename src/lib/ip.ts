// src/lib/ip.ts
/**
 * Best-effort extraction du client IP depuis les headers proxy/CDN.
 * Compatible Next.js (req.headers = Web Headers).
 */
export function getClientIp(headers: Headers): string {
  const xff = (headers.get("x-forwarded-for") || "").trim();

  const firstFromXff = xff ? xff.split(",")[0]?.trim() : "";

  const raw =
    firstFromXff ||
    (headers.get("x-real-ip") || "").trim() ||
    (headers.get("cf-connecting-ip") || "").trim() ||
    (headers.get("true-client-ip") || "").trim() ||
    (headers.get("fastly-client-ip") || "").trim() ||
    "0.0.0.0";

  return stripPortAndBrackets(raw) || "0.0.0.0";
}

function stripPortAndBrackets(ip: string): string {
  let s = (ip || "").trim();
  if (!s) return "";

  // Format: "[2001:db8::1]:1234"
  if (s.startsWith("[")) {
    const end = s.indexOf("]");
    if (end > 0) s = s.slice(1, end);
    return s.trim();
  }

  // Format: "1.2.3.4:1234" (IPv4 only)
  const colonCount = (s.match(/:/g) || []).length;
  if (colonCount === 1 && s.includes(".")) {
    const [host] = s.split(":");
    return (host || "").trim();
  }

  // IPv6 (non-bracketed) => keep
  return s;
}
