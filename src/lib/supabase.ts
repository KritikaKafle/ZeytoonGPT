import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  subscription_plan_id: string | null;
  subscription_status: string;
  subscription_started_at: string;
  subscription_expires_at: string | null;
  created_at: string;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  description: string;
  features: string[];
  is_active: boolean;
  sort_order: number;
};

export type AITool = {
  id: string;
  name: string;
  display_name: string;
  description: string;
  azure_deployment_name: string;
  is_active: boolean;
  provider_id: string | null;
  model_id: string;
  system_prompt: string;
  icon_url: string;
  tags: string[];
  model_params: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
  };
};

export type ApiProvider = {
  id: string;
  name: string;
  provider_type: 'openai' | 'azure-openai' | 'anthropic' | 'custom';
  base_url: string;
  api_key: string;
  api_version: string;
  is_active: boolean;
  created_at: string;
};

export type PlanToolLimit = {
  id: string;
  plan_id: string;
  tool_id: string;
  monthly_token_limit: number;
};

export type UserToolOverride = {
  id: string;
  user_id: string;
  tool_id: string;
  monthly_token_limit: number;
};

export type TokenUsage = {
  id: string;
  user_id: string;
  tool_id: string;
  tokens_used: number;
  period_start: string;
};

export type Conversation = {
  id: string;
  user_id: string;
  title: string;
  tool_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Attachment = {
  url: string;
  name: string;
  type: string;
  size: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens_used: number;
  created_at: string;
  attachments: Attachment[];
};
