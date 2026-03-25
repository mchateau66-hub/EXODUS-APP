import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { UserUsagePanel } from "@/components/admin/user-usage-panel"
import { getCoachPriorityListingAvailability } from "@/lib/coach-priority-access"
import { getProfileBoostAvailability } from "@/lib/profile-boost-access"
import { getSearchPriorityAvailability } from "@/lib/search-priority-access"
import { getEffectiveFeatures } from "@/lib/entitlements.server"
import { getMessageDailyLimit } from "@/lib/message-daily-limit"
import { prisma } from "@/lib/db"
import { requireOnboardingStep } from "@/lib/onboarding"
import { getUsageCounters } from "@/lib/usage-tracking"
import { userHasUnlimitedMessages } from "@/server/features"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const runtime = "nodejs"

export default async function AdminUserUsagePage({ params }: { params: Promise<{ id: string }> }) {
  if (process.env.FEATURE_ADMIN_DASHBOARD === "0") redirect("/hub")

  const session = await requireOnboardingStep(3)
  const admin = session.user as { id?: string; role?: string }
  if (admin?.role !== "admin") redirect("/hub")

  const { id: targetUserId } = await params
  if (!targetUserId?.trim()) notFound()

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      stripe_customer_id: true,
    },
  })
  if (!user) notFound()

  const [
    usageCounters,
    messageDailyLimit,
    hasUnlimitedMessages,
    hasCoachPriorityListing,
    hasProfileBoost,
    hasSearchPriority,
    effectiveFeatures,
    subscription,
    subscriptionHistoryRows,
  ] = await Promise.all([
    getUsageCounters(user.id),
    getMessageDailyLimit(user.id),
    userHasUnlimitedMessages(user.id),
    getCoachPriorityListingAvailability(user.id),
    getProfileBoostAvailability(user.id),
    getSearchPriorityAvailability(user.id),
    getEffectiveFeatures(user.id),
    prisma.subscription.findFirst({
      where: { user_id: user.id },
      orderBy: { created_at: "desc" },
      select: {
        plan_key: true,
        status: true,
        current_period_end: true,
        cancel_at_period_end: true,
        created_at: true,
        updated_at: true,
        stripe_subscription_id: true,
        plan: { select: { name: true } },
      },
    }),
    prisma.subscription.findMany({
      where: { user_id: user.id },
      orderBy: { created_at: "desc" },
      take: 5,
      select: {
        plan_key: true,
        status: true,
        current_period_end: true,
        cancel_at_period_end: true,
        created_at: true,
        updated_at: true,
        stripe_subscription_id: true,
        plan: { select: { name: true } },
      },
    }),
  ])

  const messagesSentToday = usageCounters?.messages_sent_today ?? null
  const messagesRemainingToday =
    hasUnlimitedMessages || messageDailyLimit === null || messagesSentToday === null
      ? null
      : Math.max(0, messageDailyLimit - messagesSentToday)

  const billing = {
    stripeCustomerId: user.stripe_customer_id,
    hasStripeCustomer: Boolean(user.stripe_customer_id?.trim()),
    latestSubscription: subscription
      ? {
          planName: subscription.plan?.name ?? null,
          planKey: subscription.plan_key ?? null,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          createdAt: subscription.created_at,
          updatedAt: subscription.updated_at,
          stripeSubscriptionId: subscription.stripe_subscription_id,
        }
      : null,
    subscriptionHistory: subscriptionHistoryRows.map((row) => ({
      planName: row.plan?.name ?? null,
      planKey: row.plan_key ?? null,
      status: row.status,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      stripeSubscriptionId: row.stripe_subscription_id,
    })),
  }

  return (
    <main className="min-h-[100dvh] bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Admin</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text)]">
              Usage et limites
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Utilisateur <span className="font-mono text-xs text-[var(--text)]">{user.id}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/verification"
              className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg-muted)]"
            >
              Vérification coachs
            </Link>
            <Link
              href="/hub"
              className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text)]"
            >
              Hub
            </Link>
          </div>
        </div>

        <div className="mt-8">
          <UserUsagePanel
            email={user.email}
            role={user.role}
            status={user.status}
            billing={billing}
            usage={
              usageCounters
                ? {
                    messagesSentToday: usageCounters.messages_sent_today,
                    messagesSentTotal: usageCounters.messages_sent_total,
                    coachProfileViews: usageCounters.coach_profile_views,
                    searchResultViews: usageCounters.search_result_views,
                    contactUnlocks: usageCounters.contact_unlocks,
                  }
                : {
                    messagesSentToday: null,
                    messagesSentTotal: null,
                    coachProfileViews: null,
                    searchResultViews: null,
                    contactUnlocks: null,
                  }
            }
            limits={{
              hasUnlimitedMessages,
              messageDailyLimit,
              messagesRemainingToday,
              hasCoachPriorityListing,
              hasProfileBoost,
              hasSearchPriority,
            }}
            effectiveFeatures={effectiveFeatures}
          />
        </div>
      </div>
    </main>
  )
}
