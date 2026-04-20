/*
  # Watermark Support

  1. Changes
    - Adds `subscription_plans.watermark_disabled` (boolean, default false)
      When true, users on this plan receive generated images without watermark.
    - Creates `app_settings` (key/value) with the watermark logo URL key.

  2. Security
    - Enables RLS on `app_settings`.
    - Policies: anyone authenticated can read (watermark_logo_url is public-facing);
      only admins can insert/update/delete.

  3. Notes
    - Seeds an empty `watermark_logo_url` row so the admin can upload a logo later.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'watermark_disabled'
  ) THEN
    ALTER TABLE subscription_plans
      ADD COLUMN watermark_disabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can read app settings' AND tablename = 'app_settings') THEN
    CREATE POLICY "Authenticated can read app settings"
      ON app_settings FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can insert app settings' AND tablename = 'app_settings') THEN
    CREATE POLICY "Admins can insert app settings"
      ON app_settings FOR INSERT
      TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update app settings' AND tablename = 'app_settings') THEN
    CREATE POLICY "Admins can update app settings"
      ON app_settings FOR UPDATE
      TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can delete app settings' AND tablename = 'app_settings') THEN
    CREATE POLICY "Admins can delete app settings"
      ON app_settings FOR DELETE
      TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
  END IF;
END $$;

INSERT INTO app_settings (key, value) VALUES ('watermark_logo_url', '')
ON CONFLICT (key) DO NOTHING;
