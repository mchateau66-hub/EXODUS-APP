"use client"

import * as React from "react"

export type PublicRole = "athlete" | "coach"
export type PublicOffer = "standard" | "pro"
export type Billing = "monthly" | "yearly"

type PricingSelectionState = {
  role: PublicRole
  setRole: (role: PublicRole) => void

  offer: PublicOffer
  setOffer: (offer: PublicOffer) => void

  billing: Billing
  setBilling: (billing: Billing) => void

  /** true quand #pricing est dans le viewport */
  inPricing: boolean
  /** true dès que l’utilisateur a vu #pricing au moins une fois */
  hasSeenPricing: boolean
}

const PricingSelectionContext = React.createContext<PricingSelectionState | null>(null)

export function PricingSelectionProvider({
  initialRole = "athlete",
  initialOffer = "standard",
  initialBilling = "monthly",
  pricingId = "pricing",
  children,
}: {
  initialRole?: PublicRole
  initialOffer?: PublicOffer
  initialBilling?: Billing
  pricingId?: string
  children: React.ReactNode
}) {
  const [role, setRole] = React.useState<PublicRole>(initialRole)
  const [offer, setOffer] = React.useState<PublicOffer>(initialOffer)
  const [billing, setBilling] = React.useState<Billing>(initialBilling)

  const [inPricing, setInPricing] = React.useState(false)
  const [hasSeenPricing, setHasSeenPricing] = React.useState(false)

  // Single observer for pricing visibility
  React.useEffect(() => {
    let io: IntersectionObserver | null = null
    let raf = 0
  
    const attach = () => {
      const pricing = document.getElementById(pricingId)
      if (!pricing) {
        raf = window.requestAnimationFrame(attach)
        return
      }
  
      io = new IntersectionObserver(
        ([entry]) => {
          const isIn = entry.isIntersecting
          setInPricing(isIn)
          if (isIn) setHasSeenPricing(true)
        },
        { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }
      )
  
      io.observe(pricing)
    }
  
    attach()
  
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      io?.disconnect()
    }
  }, [pricingId])  

  const value = React.useMemo(
    () => ({
      role,
      setRole,
      offer,
      setOffer,
      billing,
      setBilling,
      inPricing,
      hasSeenPricing,
    }),
    [role, offer, billing, inPricing, hasSeenPricing]
  )

  return (
    <PricingSelectionContext.Provider value={value}>
      {children}
    </PricingSelectionContext.Provider>
  )
}

export function usePricingSelection() {
  const ctx = React.useContext(PricingSelectionContext)
  if (!ctx) {
    throw new Error("usePricingSelection must be used within PricingSelectionProvider")
  }
  return ctx
}
