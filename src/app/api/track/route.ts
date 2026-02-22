import { NextResponse } from "next/server"
import { analyticsStore, type TrackEvent } from "@/lib/analytics-store"

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<TrackEvent>

    if (!body?.event || typeof body.event !== "string") {
      return NextResponse.json({ ok: false, error: "Invalid event" }, { status: 400 })
    }

    analyticsStore.add({
      event: body.event,
      role: body.role,
      offer: body.offer,
      billing: body.billing,
      src: body.src,
      ts: typeof body.ts === "number" ? body.ts : Date.now(),
      path: body.path,
      ref: body.ref,
      sessionId: body.sessionId,
      ua: body.ua,
      meta: body.meta,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
