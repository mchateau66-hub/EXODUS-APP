import Stripe from "stripe"
import { BillingPeriod } from "@prisma/client"

export function billingFromStripeSubscription(
  sub: Stripe.Subscription,
): BillingPeriod | null {
  const interval = sub.items.data[0]?.price?.recurring?.interval
  if (interval === "month") return BillingPeriod.monthly
  if (interval === "year") return BillingPeriod.yearly
  return null
}
