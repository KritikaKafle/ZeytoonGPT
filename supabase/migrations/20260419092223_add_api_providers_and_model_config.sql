/*
  # Add API providers and extended model configuration

  1. New Tables
    - `api_providers` - Stores API endpoints/keys for different LLM providers
      - `id` (uuid, PK)
      - `name` (text) - display name (e.g. "OpenAI Prod", "Azure East US")
      - `provider_type` (text) - 'openai' | 'azure-openai' | 'anthropic' | 'custom'
      - `base_url` (text) - API base URL
      - `api_key` (text) - API key (admin-only access via RLS)
      - `api_version` (text) - API version for Azure
      - `is_active` (boolean)
      - `created_at` (timestamptz)

  2. Modified Tables
    - `ai_tools` - Added columns for per-model configuration:
      - `provider_id` (uuid) - link to api_providers
      - `model_id` (text) - actual model identifier sent to API
      - `system_prompt` (text) - system message injected at start of every chat
      - `icon_url` (text) - avatar/image for the model
      - `tags` (jsonb) - array of string tags
      - `model_params` (jsonb) - temperature, max_tokens, top_p, etc.

  3. Security
    - api_providers: admin-only read/write (keys must never leak to users)
    - ai_tools: existing policies unchanged
*/

CREATE TABLE IF NOT EXISTS api_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider_type text NOT NULL DEFAULT 'openai',
  base_url text NOT NULL DEFAULT '',
  api_key text NOT NULL DEFAULT '',
  api_version text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE api_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read providers" ON api_providers;
DROP POLICY IF EXISTS "Admins insert providers" ON api_providers;
DROP POLICY IF EXISTS "Admins update providers" ON api_providers;
DROP POLICY IF EXISTS "Admins delete providers" ON api_providers;

CREATE POLICY "Admins read providers"
  ON api_providers FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins insert providers"
  ON api_providers FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins update providers"
  ON api_providers FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete providers"
  ON api_providers FOR DELETE TO authenticated
  USING (public.is_admin());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_tools' AND column_name='provider_id') THEN
    ALTER TABLE ai_tools ADD COLUMN provider_id uuid REFERENCES api_providers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_tools' AND column_name='model_id') THEN
    ALTER TABLE ai_tools ADD COLUMN model_id text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_tools' AND column_name='system_prompt') THEN
    ALTER TABLE ai_tools ADD COLUMN system_prompt text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_tools' AND column_name='icon_url') THEN
    ALTER TABLE ai_tools ADD COLUMN icon_url text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_tools' AND column_name='tags') THEN
    ALTER TABLE ai_tools ADD COLUMN tags jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_tools' AND column_name='model_params') THEN
    ALTER TABLE ai_tools ADD COLUMN model_params jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;
