-- AlterEnum
ALTER TYPE "EventName" ADD VALUE 'subscription_cancel_scheduled';

-- AlterTable
ALTER TABLE "athlete_ads" ALTER COLUMN "keywords" SET DEFAULT '[]'::jsonb;
