// src/lib/track.ts

export type TrackPayload = {
  event: string
  role?: string
  offer?: string
  billing?: string
  src?: string
  meta?: Record<string, unknown>
}

function randomHex(bytes = 16) {
  // Browser-safe CSPRNG fallback (WebCrypto)
  const c = (globalThis as any).crypto as Crypto | undefined
  if (!c?.getRandomValues) {
    // Ultra-legacy fallback (dev only): on évite Math.random mais si crypto absent,
    // on retourne un ID "best effort" (non-sécurité) pour ne pas crasher.
    return `${Date.now().toString(16)}_${String(performance?.now?.() ?? 0).replace(".", "")}`
  }

  const arr = new Uint8Array(bytes)
  c.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("")
}

function getSessionId() {
  if (typeof window === "undefined") return undefined

  const key = "rc_session_id"
  const existing = window.localStorage.getItem(key)
  if (existing) return existing

  const c = (globalThis as any).crypto as Crypto | undefined
  const id =
    typeof c !== "undefined" && "randomUUID" in c && typeof (c as any).randomUUID === "function"
      ? (c as any).randomUUID()
      : `rc_${Date.now().toString(16)}_${randomHex(16)}`

  window.localStorage.setItem(key, id)
  return id
}

export function track(payload: TrackPayload) {
  if (typeof window === "undefined") return

  const body = JSON.stringify({
    ...payload,
    ts: Date.now(),
    path: window.location.pathname,
    ref: document.referrer || undefined,
    sessionId: getSessionId(),
    ua: navigator.userAgent,
  })

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" })
    navigator.sendBeacon("/api/track", blob)
    return
  }

  fetch("/api/track", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => {})
}