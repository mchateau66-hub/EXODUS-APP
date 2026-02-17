-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('monthly', 'yearly');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "billing" "BillingPeriod";

-- AlterTable
ALTER TABLE "athlete_ads" ALTER COLUMN "keywords" SET DEFAULT '[]'::jsonb;

-- CreateIndex
CREATE INDEX "Subscription_billing_idx" ON "Subscription"("billing");
