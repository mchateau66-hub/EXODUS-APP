// src/app/(public)/page.tsx
import { PricingSelectionProvider } from "@/components/public/pricing-selection"
import { Hero } from "@/components/public/hero"
import {
  ProblemSolution,
  HowItWorks,
  Pricing,
  FinalCTA,
  WhyUs,
} from "@/components/public/sections"
import { Testimonials } from "@/components/public/testimonials"
import { FAQ } from "@/components/public/faq"
import { PublicFooter } from "@/components/public/footer"
import { StickyCTA } from "@/components/public/sticky-cta"

export default function PublicHomePage() {
  return (
    <PricingSelectionProvider
      initialRole="athlete"
      initialOffer="standard"
      initialBilling="monthly"
    >
      <>
        <main className="pb-24">
          <Hero />
          <ProblemSolution />
          <HowItWorks />
          <WhyUs />
          <Testimonials />
          <Pricing />
          <FAQ />
          <FinalCTA />
          <PublicFooter />
        </main>

        <StickyCTA />
      </>
    </PricingSelectionProvider>
  )
}
