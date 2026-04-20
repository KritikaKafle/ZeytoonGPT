/*
  # Per-user watermark override

  1. Changes
    - Adds `profiles.watermark_disabled` (boolean, nullable).
      NULL = follow the plan's setting. true/false = override the plan.

  2. Security
    - No RLS changes needed; existing profile policies apply.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'watermark_disabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN watermark_disabled boolean;
  END IF;
END $$;
