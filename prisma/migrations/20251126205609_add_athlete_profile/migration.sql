-- CreateTable
CREATE TABLE "AthleteProfile" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "goalType" TEXT NOT NULL,
    "customGoal" TEXT,
    "timeframe" TEXT NOT NULL,
    "experienceLevel" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "objectiveSummary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AthleteProfile_user_id_key" ON "AthleteProfile"("user_id");

-- AddForeignKey
ALTER TABLE "AthleteProfile" ADD CONSTRAINT "AthleteProfile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
