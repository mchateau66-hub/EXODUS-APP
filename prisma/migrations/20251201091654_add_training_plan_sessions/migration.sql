/*
  Warnings:

  - The `status` column on the `TrainingSession` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropIndex
DROP INDEX "public"."TrainingPlan_user_id_start_date_idx";

-- AlterTable
ALTER TABLE "TrainingSession" DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'planned';

-- CreateIndex
CREATE INDEX "TrainingPlan_user_id_idx" ON "TrainingPlan"("user_id");
