-- Create athlete_ads table (TEXT ids) compatible with "User".id (text)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS athlete_ads (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,

  athlete_id text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,

  title text NOT NULL,
  goal text NOT NULL DEFAULT '',
  sport text NOT NULL DEFAULT '',

  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,

  country text NULL,
  city text NULL,
  language text NULL,

  budget_min integer NULL,
  budget_max integer NULL,

  lat double precision NULL,
  lng double precision NULL,

  status text NOT NULL DEFAULT 'active',
  published_until timestamptz NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT athlete_ads_status_check
    CHECK (status IN ('active','paused','removed','expired')),

  CONSTRAINT athlete_ads_budget_check
    CHECK (budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max),

  CONSTRAINT athlete_ads_lat_check
    CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),

  CONSTRAINT athlete_ads_lng_check
    CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180)),

  CONSTRAINT athlete_ads_keywords_is_array_check
    CHECK (jsonb_typeof(keywords) = 'array')
);

CREATE INDEX IF NOT EXISTS athlete_ads_active_until_idx
  ON athlete_ads (published_until DESC NULLS LAST)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS athlete_ads_country_active_idx
  ON athlete_ads (country, published_until DESC NULLS LAST)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS athlete_ads_language_active_idx
  ON athlete_ads (language, published_until DESC NULLS LAST)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS athlete_ads_lat_lng_idx
  ON athlete_ads (lat, lng);

CREATE INDEX IF NOT EXISTS athlete_ads_keywords_gin_idx
  ON athlete_ads USING GIN (keywords);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS athlete_ads_set_updated_at ON athlete_ads;

CREATE TRIGGER athlete_ads_set_updated_at
BEFORE UPDATE ON athlete_ads
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
