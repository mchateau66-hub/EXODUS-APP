/*
  Warnings:

  - Changed the type of `event` on the `Event` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "EventName" AS ENUM ('hero_click', 'pricing_click', 'sticky_click', 'finalcta_click', 'signup_submit', 'checkout_start', 'checkout_success', 'subscription_active', 'subscription_canceled');

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "event",
ADD COLUMN     "event" "EventName" NOT NULL;

-- AlterTable
ALTER TABLE "athlete_ads" ALTER COLUMN "keywords" SET DEFAULT '[]'::jsonb;

-- CreateIndex
CREATE INDEX "Event_event_ts_idx" ON "Event"("event", "ts");
