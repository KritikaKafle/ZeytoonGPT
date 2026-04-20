/*
  # Constrain ai_tools.model_kind values

  1. Changes
    - Adds CHECK constraint restricting model_kind to ('chat','image','video').

  2. Security
    - No RLS changes.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_tools_model_kind_check'
  ) THEN
    ALTER TABLE ai_tools
      ADD CONSTRAINT ai_tools_model_kind_check
      CHECK (model_kind IN ('chat', 'image', 'video'));
  END IF;
END $$;
