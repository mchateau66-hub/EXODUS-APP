import Stripe from 'stripe'

const secretKey = process.env.STRIPE_SECRET_KEY
if (!secretKey) {
  throw new Error('STRIPE_SECRET_KEY not set')
}

export const stripe = new Stripe(secretKey, {
  // On garde l'API version que tu veux, mais on la caste pour TypeScript
  apiVersion: '2024-06-20' as any,
})
