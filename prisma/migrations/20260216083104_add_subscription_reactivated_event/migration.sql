-- AlterEnum
ALTER TYPE "EventName" ADD VALUE 'subscription_reactivated';

-- AlterTable
ALTER TABLE "athlete_ads" ALTER COLUMN "keywords" SET DEFAULT '[]'::jsonb;
