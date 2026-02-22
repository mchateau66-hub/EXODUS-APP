-- AlterTable
ALTER TABLE "athlete_ads" ALTER COLUMN "keywords" SET DEFAULT '[]'::jsonb;

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT,
    "event" TEXT NOT NULL,
    "role" "Role",
    "offer" TEXT,
    "billing" TEXT,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_ts_idx" ON "Event"("ts");

-- CreateIndex
CREATE INDEX "Event_event_ts_idx" ON "Event"("event", "ts");

-- CreateIndex
CREATE INDEX "Event_session_id_ts_idx" ON "Event"("session_id", "ts");

-- CreateIndex
CREATE INDEX "Event_role_offer_billing_idx" ON "Event"("role", "offer", "billing");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
