// src/app/api/sports/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { SPORTS_TAXONOMY } from "@/data/sports"

export const runtime = "nodejs"

type SportItem = { label: string; count: number }

function normKey(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-’']/g, " ") // ✅ tirets/apostrophes => espace
    .replace(/\s+/g, " ")
}

function toSportsList(mainSports: unknown): string[] {
  if (!mainSports) return []
  if (Array.isArray(mainSports)) return mainSports.map(String)
  if (typeof mainSports === "string") {
    return mainSports
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
  }
  return []
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)

  const q = (url.searchParams.get("q") ?? "").trim()
  const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get("limit") || "20", 10)))

  // ✅ FAST PATH: autocomplete (pas de DB)
  if (q) {
    const qk = normKey(q)
    const seen = new Set<string>()

    const hits = SPORTS_TAXONOMY
      .map((label) => {
        const k = normKey(label)
        const starts = k.startsWith(qk)
        const includes = k.includes(qk)
        const score = starts ? 2 : includes ? 1 : 0
        return { label, k, score }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "fr"))
      .filter((x) => {
        if (seen.has(x.k)) return false
        seen.add(x.k)
        return true
      })
      .slice(0, limit)
      .map((x) => ({ label: x.label, count: 0 }))

    return NextResponse.json(
      { sports: hits },
      {
        headers: {
          "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    )
  }

  // ✅ Pas de q => "populaires" (DB + fallback taxonomie)
  const take = Math.max(1, Math.min(5000, parseInt(url.searchParams.get("take") || "2000", 10)))

  try {
    const counts = new Map<string, SportItem>()

    // init depuis taxonomie (count 0) + dédup
    for (const s of SPORTS_TAXONOMY) {
      const k = normKey(s)
      if (!counts.has(k)) counts.set(k, { label: s, count: 0 })
    }

    const rows = await prisma.coach.findMany({
      take,
      select: {
        user: { select: { onboardingStep2Answers: true } },
      },
    })

    for (const r of rows) {
      const step2 = (r.user as any)?.onboardingStep2Answers ?? {}
      const list = toSportsList(step2?.mainSports)

      for (const raw of list) {
        const label = String(raw).trim()
        if (!label) continue

        const k = normKey(label)
        const prev = counts.get(k)
        if (prev) prev.count += 1
        else counts.set(k, { label, count: 1 }) // sport hors taxonomie
      }
    }

    const sports: SportItem[] = Array.from(counts.values())
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"))
      .slice(0, limit)

    return NextResponse.json(
      { sports },
      {
        headers: {
          "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    )
  } catch {
    const fallback: SportItem[] = SPORTS_TAXONOMY
      .slice(0, limit)
      .map((s) => ({ label: s, count: 0 }))

    return NextResponse.json({ sports: fallback }, { headers: { "cache-control": "no-store" } })
  }
}
