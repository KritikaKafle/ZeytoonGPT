/*
  # Add extended pricing fields to subscription_plans

  1. Changes
    - Add `price_yearly` (numeric) for annual pricing
    - Add `currency` (text, default 'USD') so admins can set custom currencies
  2. Security
    - No RLS changes; existing policies remain intact
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'price_yearly'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN price_yearly numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'currency'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN currency text DEFAULT 'USD';
  END IF;
END $$;