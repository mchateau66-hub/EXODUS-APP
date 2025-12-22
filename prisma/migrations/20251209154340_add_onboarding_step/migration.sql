-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardingStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "onboardingStep1Answers" JSONB;
