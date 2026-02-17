/*
  Warnings:

  - A unique constraint covering the columns `[user_id,feature_key,source,subscription_id]` on the table `UserEntitlement` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "athlete_ads" ALTER COLUMN "keywords" SET DEFAULT '[]'::jsonb;

-- CreateTable
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created" INTEGER NOT NULL,
    "livemode" BOOLEAN NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserEntitlement_user_id_feature_key_source_subscription_id_key" ON "UserEntitlement"("user_id", "feature_key", "source", "subscription_id");
