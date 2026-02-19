import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import Stripe from 'stripe'
import { BillingPeriod, PrismaClient } from '@prisma/client'

/**
 * Load env (works outside Next.js)
 */
function loadEnv() {
  const cwd = process.cwd()
  const candidates = ['.env.local', '.env.development.local', '.env']

  for (const file of candidates) {
    const full = path.join(cwd, file)
    if (fs.existsSync(full)) {
      dotenv.config({ path: full })
      console.log(`[env] loaded ${file}`)
      return
    }
  }

  console.warn('[env] no env file found')
}

loadEnv()

if (!process.env.STRIPE_SECRET_KEY) throw new Error('Missing STRIPE_SECRET_KEY')
if (!process.env.DATABASE_URL) throw new Error('Missing DATABASE_URL')

/**
 * Init clients
 */
const prisma = new PrismaClient()

const stripeSecret = process.env.STRIPE_SECRET_KEY

// Stripe typings can be strict about apiVersion literal unions depending on the SDK version.
// This cast keeps compilation stable while still sending the value at runtime.
const stripe = new Stripe(stripeSecret, {
  apiVersion: '2024-06-20',
} as unknown as Stripe.StripeConfig)

/**
 * Infer billing from Stripe subscription
 */
function inferBillingFromStripe(sub: Stripe.Subscription): BillingPeriod | null {
  const interval = sub.items.data[0]?.price?.recurring?.interval
  if (interval === 'month') return BillingPeriod.monthly
  if (interval === 'year') return BillingPeriod.yearly
  return null
}

/**
 * Main
 */
async function main() {
  const subs = await prisma.subscription.findMany({
    where: {
      stripe_subscription_id: { not: '' },
      billing: null, // ✅ only missing billing
    },
    select: {
      id: true,
      stripe_subscription_id: true,
    },
  })

  console.log(`[clean-backfill] subscriptions missing billing: ${subs.length}`)

  let updated = 0
  let skipped = 0
  let unknown = 0
  let notFound = 0

  for (const s of subs) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(
        s.stripe_subscription_id,
        { expand: ['items.data.price'] },
      )

      const billing = inferBillingFromStripe(stripeSub)

      if (!billing) {
        unknown++
        continue
      }

      await prisma.subscription.update({
        where: { id: s.id },
        data: { billing },
      })

      updated++
    } catch (err: any) {
      // Stripe not found
      if (err?.statusCode === 404) {
        notFound++
        continue
      }

      console.error(`Error on sub ${s.stripe_subscription_id}`, err?.message ?? err)
      skipped++
    }
  }

  console.log('\n======= RESULT =======')
  console.log('Updated:', updated)
  console.log('Unknown interval:', unknown)
  console.log('Stripe not found:', notFound)
  console.log('Skipped errors:', skipped)
  console.log('======================\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
