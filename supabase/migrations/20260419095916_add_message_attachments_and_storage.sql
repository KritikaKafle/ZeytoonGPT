/*
  # Add message attachments and storage bucket

  1. Schema
    - Adds `attachments` jsonb column to `messages` table to store an array
      of uploaded files (each: { url, name, type, size }).
  2. Storage
    - Creates public storage bucket `chat-attachments` so uploaded images/docs
      can be referenced by URL in chats.
    - Adds RLS policies on `storage.objects`:
      * Authenticated users can upload to their own folder (prefix = auth.uid()).
      * Authenticated users can read/delete their own files.
      * Public read so image URLs work in the UI and for vision models.
  3. Notes
    - Files are stored under `{user_id}/...` so each user owns their folder.
    - Existing messages default to empty array.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'attachments'
  ) THEN
    ALTER TABLE messages ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'chat_attachments_public_read'
  ) THEN
    CREATE POLICY "chat_attachments_public_read"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'chat-attachments');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'chat_attachments_user_insert'
  ) THEN
    CREATE POLICY "chat_attachments_user_insert"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'chat-attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'chat_attachments_user_update'
  ) THEN
    CREATE POLICY "chat_attachments_user_update"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'chat-attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'chat-attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'chat_attachments_user_delete'
  ) THEN
    CREATE POLICY "chat_attachments_user_delete"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'chat-attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;
