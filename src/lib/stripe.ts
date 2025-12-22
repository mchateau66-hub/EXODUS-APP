// src/lib/stripe.ts
import Stripe from "stripe";

let client: Stripe | null = null;

function getClient(): Stripe {
  if (client) return client;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    // ⚠️ IMPORTANT: on ne throw PAS au top-level, seulement ici (runtime)
    throw new Error("STRIPE_SECRET_KEY not set");
  }

  client = new Stripe(key);
  return client;
}

// ✅ compat: les imports existants `import { stripe } from "@/lib/stripe"` restent valides
export const stripe = new Proxy(
  {},
  {
    get(_target, prop) {
      const c = getClient() as any;
      return c[prop];
    },
  }
) as unknown as Stripe;

// (optionnel) si tu veux l’utiliser ailleurs
export function getStripe(): Stripe {
  return getClient();
}
