/*
  # Seed default subscription plans and AI tools

  1. Default Plans: Free, Pro, Enterprise
  2. Default AI Tools: GPT-3.5, GPT-4, GPT-4 Turbo
  3. Default plan-tool limits
*/

INSERT INTO subscription_plans (name, price_monthly, description, features, sort_order) VALUES
  ('Free', 0, 'Get started with basic AI access', '["Limited tokens per month", "GPT-3.5 access", "Basic support"]'::jsonb, 1),
  ('Pro', 19.99, 'For power users and professionals', '["Generous token allowance", "Access to all models", "Priority support", "Conversation history"]'::jsonb, 2),
  ('Enterprise', 99.99, 'Unlimited power for teams', '["Unlimited tokens", "All premium models", "24/7 support", "Custom integrations", "Admin dashboard"]'::jsonb, 3)
ON CONFLICT (name) DO NOTHING;

INSERT INTO ai_tools (name, display_name, description, azure_deployment_name) VALUES
  ('gpt-35-turbo', 'GPT-3.5 Turbo', 'Fast, efficient conversations for everyday tasks', 'gpt-35-turbo'),
  ('gpt-4', 'GPT-4', 'Advanced reasoning for complex problems', 'gpt-4'),
  ('gpt-4-turbo', 'GPT-4 Turbo', 'Latest generation with extended context', 'gpt-4-turbo')
ON CONFLICT (name) DO NOTHING;

INSERT INTO plan_tool_limits (plan_id, tool_id, monthly_token_limit)
SELECT p.id, t.id,
  CASE
    WHEN p.name = 'Free' AND t.name = 'gpt-35-turbo' THEN 50000
    WHEN p.name = 'Free' AND t.name = 'gpt-4' THEN 0
    WHEN p.name = 'Free' AND t.name = 'gpt-4-turbo' THEN 0
    WHEN p.name = 'Pro' AND t.name = 'gpt-35-turbo' THEN 1000000
    WHEN p.name = 'Pro' AND t.name = 'gpt-4' THEN 200000
    WHEN p.name = 'Pro' AND t.name = 'gpt-4-turbo' THEN 100000
    WHEN p.name = 'Enterprise' THEN -1
    ELSE 0
  END
FROM subscription_plans p
CROSS JOIN ai_tools t
ON CONFLICT (plan_id, tool_id) DO NOTHING;

UPDATE profiles SET subscription_plan_id = (SELECT id FROM subscription_plans WHERE name = 'Free')
WHERE subscription_plan_id IS NULL;
