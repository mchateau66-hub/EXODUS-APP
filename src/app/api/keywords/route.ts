// src/app/api/keywords/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { KEYWORDS_TAXONOMY } from "@/data/keywords"

export const runtime = "nodejs"

type Item = { label: string; count: number }

function normKey(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
}

function toList(v: unknown): string[] {
  if (!v) return []
  if (Array.isArray(v)) return v.map(String).map((x) => x.trim()).filter(Boolean)
  if (typeof v === "string") {
    return v.split(",").map((x) => x.trim()).filter(Boolean)
  }
  return []
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const q = (url.searchParams.get("q") ?? "").trim()
  const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get("limit") || "20", 10)))

  // ✅ FAST PATH (autocomplete) : pas de DB
  if (q) {
    const qk = normKey(q)
    const filtered: Item[] = KEYWORDS_TAXONOMY
      .filter((s: string) => normKey(s).includes(qk))
      .slice(0, limit)
      .map((s: string) => ({ label: s, count: 0 }))

    return NextResponse.json(
      { keywords: filtered },
      { headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    )
  }

  // ✅ Populaires (DB + fallback taxonomie)
  const take = Math.max(1, Math.min(5000, parseInt(url.searchParams.get("take") || "2000", 10)))

  try {
    const counts = new Map<string, Item>()

    for (const s of KEYWORDS_TAXONOMY) {
      const k = normKey(s)
      if (!counts.has(k)) counts.set(k, { label: s, count: 0 })
    }

    // On suppose que les keywords sont stockés dans onboardingStep2Answers.keywords
    const rows = await prisma.coach.findMany({
      take,
      select: {
        user: { select: { onboardingStep2Answers: true } },
      },
    })

    for (const r of rows) {
      const step2 = (r.user as any)?.onboardingStep2Answers ?? {}
      const list = toList(step2?.keywords)

      for (const raw of list) {
        const label = String(raw).trim()
        if (!label) continue
        const k = normKey(label)
        const prev = counts.get(k)
        if (prev) prev.count += 1
        else counts.set(k, { label, count: 1 })
      }
    }

    const keywords: Item[] = Array.from(counts.values())
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"))
      .slice(0, limit)

    return NextResponse.json(
      { keywords },
      { headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    )
  } catch {
    const fallback: Item[] = KEYWORDS_TAXONOMY.slice(0, limit).map((s) => ({ label: s, count: 0 }))
    return NextResponse.json({ keywords: fallback }, { headers: { "cache-control": "no-store" } })
  }
}
