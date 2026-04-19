import { supabase } from './supabase';

import type { Attachment } from './supabase';

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Attachment[];
};

export type ChatResponse = {
  message: string;
  tokensUsed: number;
  error?: string;
};

export async function sendChatMessage(
  toolId: string,
  messages: ChatMessage[]
): Promise<ChatResponse> {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) return { message: '', tokensUsed: 0, error: 'Not authenticated' };

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/azure-chat`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ toolId, messages }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { message: '', tokensUsed: 0, error: data.error || 'Request failed' };
    }
    return data;
  } catch (err) {
    return {
      message: '',
      tokensUsed: 0,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
