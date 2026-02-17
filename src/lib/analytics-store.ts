export type TrackEvent = {
  event: string
  role?: string
  offer?: string
  billing?: string
  src?: string
  ts: number
  path?: string
  ref?: string
  sessionId?: string
  ua?: string
  meta?: Record<string, unknown>
}

class AnalyticsStore {
  private events: TrackEvent[] = []

  add(event: TrackEvent) {
    this.events.push(event)
    if (this.events.length > 10000) this.events.shift()
  }

  getAll(): TrackEvent[] {
    return this.events
  }

  clear() {
    this.events = []
  }
}

export const analyticsStore =
  (globalThis as any).__analyticsStore ??
  ((globalThis as any).__analyticsStore = new AnalyticsStore())
