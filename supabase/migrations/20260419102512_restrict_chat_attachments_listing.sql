/*
  # Restrict chat-attachments bucket listing

  1. Security Changes
    - Drop `chat_attachments_public_read` policy which allowed anyone to list/read all files in the bucket
    - Add `chat_attachments_user_read` policy so only authenticated owners can list/read their own files via the storage API
    - Public object URLs still work because the bucket is public (URL access bypasses SELECT policies)

  2. Notes
    - This prevents clients from enumerating all attachments in the bucket
    - Individual file URLs continue to work for sharing
*/

DROP POLICY IF EXISTS "chat_attachments_public_read" ON storage.objects;

CREATE POLICY "chat_attachments_user_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );