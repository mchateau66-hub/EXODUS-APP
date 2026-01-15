-- CreateTable
CREATE TABLE "athlete_ads" (
    "id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goal" TEXT NOT NULL DEFAULT '',
    "sport" TEXT NOT NULL DEFAULT '',
    "keywords" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "country" TEXT,
    "city" TEXT,
    "language" TEXT,
    "budget_min" INTEGER,
    "budget_max" INTEGER,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'active',
    "published_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_ads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "athlete_ads_athlete_id_idx" ON "athlete_ads"("athlete_id");

-- CreateIndex
CREATE INDEX "athlete_ads_country_idx" ON "athlete_ads"("country");

-- CreateIndex
CREATE INDEX "athlete_ads_language_idx" ON "athlete_ads"("language");

-- CreateIndex
CREATE INDEX "athlete_ads_lat_lng_idx" ON "athlete_ads"("lat", "lng");

-- CreateIndex
CREATE INDEX "athlete_ads_status_published_until_idx" ON "athlete_ads"("status", "published_until");

-- AddForeignKey
ALTER TABLE "athlete_ads" ADD CONSTRAINT "athlete_ads_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
