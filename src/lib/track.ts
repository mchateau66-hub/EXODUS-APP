// src/lib/track.ts

export type TrackPayload = {
  event: string
  role?: string
  offer?: string
  billing?: string
  src?: string
  meta?: Record<string, unknown>
}

function getSessionId() {
  if (typeof window === "undefined") return undefined

  const key = "rc_session_id"
  const existing = window.localStorage.getItem(key)
  if (existing) return existing

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`

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
