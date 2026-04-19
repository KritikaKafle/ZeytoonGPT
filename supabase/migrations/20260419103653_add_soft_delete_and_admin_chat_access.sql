/*
  # Soft-delete conversations and admin full chat history access

  1. Changes
    - Add `deleted_at` timestamptz column to `conversations` (nullable).
      - Null = active. Non-null = soft-deleted.
    - Rename/replace user-facing RLS policies so users only see/work with
      their non-deleted conversations and messages.
    - Add admin RLS policies so admins can read ALL conversations and ALL
      messages, including soft-deleted ones (needed for compliance,
      disputes, or legal discovery).
    - Replace the user DELETE policy on conversations with a "soft delete"
      pattern: users UPDATE `deleted_at` instead of hard-deleting. Hard
      deletes remain available to admins only.

  2. Security
    - RLS stays enabled on both `conversations` and `messages`.
    - Regular users: only see rows where deleted_at IS NULL and they own it.
    - Admins: see everything, including soft-deleted chats and their messages.
    - No table exposes other users' data to regular users.

  3. Important Notes
    - Existing conversations are treated as active (deleted_at is null by default).
    - Frontend must be updated to soft-delete (UPDATE deleted_at) rather than
      issuing a DELETE. Admins retain ability to perform true deletes if ever needed.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE conversations ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at ON conversations(deleted_at);

DROP POLICY IF EXISTS "Users view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users update own conversations" ON conversations;
DROP POLICY IF EXISTS "Users delete own conversations" ON conversations;
DROP POLICY IF EXISTS "Admins view all conversations" ON conversations;
DROP POLICY IF EXISTS "Admins update all conversations" ON conversations;
DROP POLICY IF EXISTS "Admins delete all conversations" ON conversations;

CREATE POLICY "Users view own active conversations"
  ON conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Admins view all conversations"
  ON conversations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Users update own conversations"
  ON conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins update all conversations"
  ON conversations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins delete conversations"
  ON conversations FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Users view own messages" ON messages;
DROP POLICY IF EXISTS "Users insert own messages" ON messages;
DROP POLICY IF EXISTS "Users delete own messages" ON messages;
DROP POLICY IF EXISTS "Admins view all messages" ON messages;
DROP POLICY IF EXISTS "Admins delete all messages" ON messages;

CREATE POLICY "Users view own active messages"
  ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND c.user_id = auth.uid()
        AND c.deleted_at IS NULL
    )
  );

CREATE POLICY "Admins view all messages"
  ON messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Users insert messages in active conversations"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND c.user_id = auth.uid()
        AND c.deleted_at IS NULL
    )
  );

CREATE POLICY "Admins delete messages"
  ON messages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
