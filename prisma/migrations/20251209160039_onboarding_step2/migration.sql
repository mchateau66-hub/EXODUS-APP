-- AlterTable
ALTER TABLE "User" ADD COLUMN     "coachQualificationScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "onboardingStep2Answers" JSONB;
