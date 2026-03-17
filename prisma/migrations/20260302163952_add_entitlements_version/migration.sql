/*
  Warnings:

  - The values [subscription_cancel_scheduled,subscription_reactivated] on the enum `EventName` will be removed. If these variants are still used in the database, this will fail.
  - The `role` column on the `Event` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `processed_at` on the `StripeEvent` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EventName_new" AS ENUM ('hero_click', 'pricing_click', 'signup_submit', 'checkout_success', 'sticky_click', 'finalcta_click', 'checkout_start', 'subscription_active', 'subscription_canceled');
ALTER TABLE "Event" ALTER COLUMN "event" TYPE "EventName_new" USING ("event"::text::"EventName_new");
ALTER TYPE "EventName" RENAME TO "EventName_old";
ALTER TYPE "EventName_new" RENAME TO "EventName";
DROP TYPE "public"."EventName_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_user_id_fkey";

-- DropIndex
DROP INDEX "Event_event_ts_idx";

-- DropIndex
DROP INDEX "Event_role_offer_billing_idx";

-- DropIndex
DROP INDEX "Event_session_id_ts_idx";

-- DropIndex
DROP INDEX "Subscription_billing_idx";

-- DropIndex
DROP INDEX "UserEntitlement_user_id_feature_key_source_subscription_id_key";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "role",
ADD COLUMN     "role" TEXT;

-- AlterTable
ALTER TABLE "StripeEvent" DROP COLUMN "processed_at",
ADD COLUMN     "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "entitlements_version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "sat_jti" (
    "jti" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,

    CONSTRAINT "sat_jti_pkey" PRIMARY KEY ("jti")
);

-- CreateTable
CREATE TABLE "EntitlementJti" (
    "jti" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sid" TEXT,
    "exp_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntitlementJti_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE INDEX "sat_jti_consumed_at_idx" ON "sat_jti"("consumed_at");

-- CreateIndex
CREATE INDEX "sat_jti_expires_at_idx" ON "sat_jti"("expires_at");

-- CreateIndex
CREATE INDEX "sat_jti_user_id_idx" ON "sat_jti"("user_id");

-- CreateIndex
CREATE INDEX "EntitlementJti_user_id_idx" ON "EntitlementJti"("user_id");

-- CreateIndex
CREATE INDEX "EntitlementJti_exp_at_idx" ON "EntitlementJti"("exp_at");

-- CreateIndex
CREATE INDEX "Event_session_id_idx" ON "Event"("session_id");

-- CreateIndex
CREATE INDEX "Event_event_idx" ON "Event"("event");

-- CreateIndex
CREATE INDEX "Event_user_id_idx" ON "Event"("user_id");

-- CreateIndex
CREATE INDEX "StripeEvent_type_idx" ON "StripeEvent"("type");

-- CreateIndex
CREATE INDEX "StripeEvent_created_idx" ON "StripeEvent"("created");

-- AddForeignKey
ALTER TABLE "EntitlementJti" ADD CONSTRAINT "EntitlementJti_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
