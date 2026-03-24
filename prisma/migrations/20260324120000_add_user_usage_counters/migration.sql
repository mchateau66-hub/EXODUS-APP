-- CreateTable
CREATE TABLE "user_usage_counters" (
    "user_id" TEXT NOT NULL,
    "messages_sent_today" INTEGER NOT NULL DEFAULT 0,
    "messages_sent_total" INTEGER NOT NULL DEFAULT 0,
    "coach_profile_views" INTEGER NOT NULL DEFAULT 0,
    "search_result_views" INTEGER NOT NULL DEFAULT 0,
    "contact_unlocks" INTEGER NOT NULL DEFAULT 0,
    "daily_reset_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_usage_counters_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "user_usage_counters" ADD CONSTRAINT "user_usage_counters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
