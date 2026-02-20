"use client"

import * as React from "react"

export function useScrollSpy(
  sectionIds: string[],
  options?: IntersectionObserverInit & { rootMargin?: string }
) {
  const [activeId, setActiveId] = React.useState<string | null>(null)

  // ✅ deps stables pour satisfaire react-hooks/exhaustive-deps
  const rootMargin = options?.rootMargin ?? "-15% 0px -70% 0px"
  const sectionKey = sectionIds.join("|")

  React.useEffect(() => {
    if (!sectionIds.length) return

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[]

    if (!elements.length) return

    // If the hash is already set on load, prefer it
    const hash = window.location.hash?.replace("#", "")
    if (hash && sectionIds.includes(hash)) setActiveId(hash)

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the most visible intersecting section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))

        if (visible[0]?.target?.id) setActiveId(visible[0].target.id)
      },
      {
        // “active” when section is in the top/middle band
        root: null,
        threshold: [0.1, 0.2, 0.35, 0.5, 0.65],
        rootMargin,
      }
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [sectionKey, rootMargin, sectionIds])

  return activeId
}
