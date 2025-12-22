/*
  Warnings:

  - Made the column `stripe_subscription_id` on table `Subscription` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "expires_at" TIMESTAMP(3),
ALTER COLUMN "stripe_subscription_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "AuditLog_user_id_idx" ON "AuditLog"("user_id");
