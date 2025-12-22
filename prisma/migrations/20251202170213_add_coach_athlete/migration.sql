/*
  Warnings:

  - The `status` column on the `TrainingSession` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "CoachAthleteStatus" AS ENUM ('LEAD', 'ACTIVE', 'TO_FOLLOW', 'ENDED');

-- AlterTable
ALTER TABLE "TrainingSession" DROP COLUMN "status",
ADD COLUMN     "status" "TrainingSessionStatus" NOT NULL DEFAULT 'planned';

-- CreateTable
CREATE TABLE "CoachAthlete" (
    "coach_id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "status" "CoachAthleteStatus" NOT NULL DEFAULT 'LEAD',
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nextFollowUpAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachAthlete_pkey" PRIMARY KEY ("coach_id","athlete_id")
);

-- CreateIndex
CREATE INDEX "CoachAthlete_coach_id_status_nextFollowUpAt_idx" ON "CoachAthlete"("coach_id", "status", "nextFollowUpAt");

-- AddForeignKey
ALTER TABLE "CoachAthlete" ADD CONSTRAINT "CoachAthlete_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachAthlete" ADD CONSTRAINT "CoachAthlete_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
