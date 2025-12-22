/*
  Warnings:

  - You are about to drop the column `consumed_at` on the `PasswordResetToken` table. All the data in the column will be lost.
  - You are about to drop the column `password_hash` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."PasswordResetToken_user_id_expires_at_idx";

-- AlterTable
ALTER TABLE "PasswordResetToken" DROP COLUMN "consumed_at",
ADD COLUMN     "used_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "password_hash",
ADD COLUMN     "passwordHash" TEXT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "PasswordResetToken_user_id_idx" ON "PasswordResetToken"("user_id");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expires_at_idx" ON "PasswordResetToken"("expires_at");
