/*
  # AI Chat Platform Schema

  1. New Tables
    - `profiles` - User profile data linked to auth.users
      - `id` (uuid, PK, references auth.users)
      - `email` (text)
      - `full_name` (text)
      - `role` (text) - 'user' or 'admin'
      - `subscription_plan_id` (uuid, nullable) - current plan
      - `subscription_status` (text) - active, cancelled, expired
      - `subscription_started_at` (timestamptz)
      - `subscription_expires_at` (timestamptz)
      - `created_at` (timestamptz)

    - `subscription_plans` - Available subscription tiers
      - `id` (uuid, PK)
      - `name` (text) - Free, Pro, Enterprise
      - `price_monthly` (numeric)
      - `description` (text)
      - `features` (jsonb) - array of feature strings
      - `is_active` (boolean)
      - `sort_order` (int)
      - `created_at` (timestamptz)

    - `ai_tools` - Available AI models/tools
      - `id` (uuid, PK)
      - `name` (text) - e.g. 'gpt-4', 'gpt-3.5-turbo'
      - `display_name` (text) - e.g. 'GPT-4'
      - `description` (text)
      - `azure_deployment_name` (text)
      - `is_active` (boolean)
      - `created_at` (timestamptz)

    - `plan_tool_limits` - Token limits per tool per plan
      - `id` (uuid, PK)
      - `plan_id` (uuid, FK subscription_plans)
      - `tool_id` (uuid, FK ai_tools)
      - `monthly_token_limit` (bigint) - -1 for unlimited
      - `created_at` (timestamptz)

    - `user_tool_overrides` - Per-user custom limits (admin managed)
      - `id` (uuid, PK)
      - `user_id` (uuid, FK profiles)
      - `tool_id` (uuid, FK ai_tools)
      - `monthly_token_limit` (bigint)
      - `created_at` (timestamptz)

    - `token_usage` - Track token usage per user/tool
      - `id` (uuid, PK)
      - `user_id` (uuid, FK profiles)
      - `tool_id` (uuid, FK ai_tools)
      - `tokens_used` (int)
      - `period_start` (date) - first day of month
      - `created_at` (timestamptz)

    - `conversations` - Chat conversations
      - `id` (uuid, PK)
      - `user_id` (uuid, FK profiles)
      - `title` (text)
      - `tool_id` (uuid, FK ai_tools)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `messages` - Chat messages
      - `id` (uuid, PK)
      - `conversation_id` (uuid, FK conversations)
      - `role` (text) - user, assistant, system
      - `content` (text)
      - `tokens_used` (int)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can view/manage own data only
    - Admins can view/manage all data
    - Plans and tools readable by all authenticated users
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text DEFAULT '',
  role text NOT NULL DEFAULT 'user',
  subscription_plan_id uuid,
  subscription_status text NOT NULL DEFAULT 'active',
  subscription_started_at timestamptz DEFAULT now(),
  subscription_expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  price_monthly numeric NOT NULL DEFAULT 0,
  description text DEFAULT '',
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text DEFAULT '',
  azure_deployment_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_tool_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  tool_id uuid NOT NULL REFERENCES ai_tools(id) ON DELETE CASCADE,
  monthly_token_limit bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plan_id, tool_id)
);

CREATE TABLE IF NOT EXISTS user_tool_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tool_id uuid NOT NULL REFERENCES ai_tools(id) ON DELETE CASCADE,
  monthly_token_limit bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tool_id)
);

CREATE TABLE IF NOT EXISTS token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tool_id uuid NOT NULL REFERENCES ai_tools(id) ON DELETE CASCADE,
  tokens_used int NOT NULL DEFAULT 0,
  period_start date NOT NULL DEFAULT date_trunc('month', now())::date,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tool_id, period_start)
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Chat',
  tool_id uuid REFERENCES ai_tools(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  tokens_used int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_user_period ON token_usage(user_id, period_start);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_tool_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tool_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Users insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Anyone read active plans"
  ON subscription_plans FOR SELECT TO authenticated
  USING (is_active = true OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins insert plans"
  ON subscription_plans FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins update plans"
  ON subscription_plans FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins delete plans"
  ON subscription_plans FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Anyone read active tools"
  ON ai_tools FOR SELECT TO authenticated
  USING (is_active = true OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins insert tools"
  ON ai_tools FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins update tools"
  ON ai_tools FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins delete tools"
  ON ai_tools FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Anyone read plan limits"
  ON plan_tool_limits FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins insert plan limits"
  ON plan_tool_limits FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins update plan limits"
  ON plan_tool_limits FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins delete plan limits"
  ON plan_tool_limits FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Users view own overrides"
  ON user_tool_overrides FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins insert overrides"
  ON user_tool_overrides FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins update overrides"
  ON user_tool_overrides FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins delete overrides"
  ON user_tool_overrides FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Users view own usage"
  ON token_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Users insert own usage"
  ON token_usage FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own usage"
  ON token_usage FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Users view own conversations"
  ON conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own conversations"
  ON conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own conversations"
  ON conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own conversations"
  ON conversations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users view own messages"
  ON messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));

CREATE POLICY "Users insert own messages"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));

CREATE POLICY "Users delete own messages"
  ON messages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
