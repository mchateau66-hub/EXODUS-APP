export const ALLOWED_OFFERS = new Set(["free", "athlete_premium", "coach_premium"]);

export function assertOfferAllowed(offer: string) {
  if (!ALLOWED_OFFERS.has(offer)) {
    throw new Error(`Offer not allowed: ${offer}`);
  }
}