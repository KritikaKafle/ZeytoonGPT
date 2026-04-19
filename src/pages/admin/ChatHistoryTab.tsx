import { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Search, Trash2, ArrowLeft, User, Bot, Clock, AlertTriangle } from 'lucide-react';
import { supabase, Conversation, Message, Profile } from '../../lib/supabase';

type ConversationWithUser = Conversation & { profile?: Profile };

export default function ChatHistoryTab() {
  const [conversations, setConversations] = useState<ConversationWithUser[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'deleted'>('all');
  const [selected, setSelected] = useState<ConversationWithUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [c, p] = await Promise.all([
      supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ]);
    const profileMap: Record<string, Profile> = {};
    (p.data || []).forEach(pr => { profileMap[pr.id] = pr; });
    setProfiles(profileMap);
    const withUser = (c.data || []).map(conv => ({
      ...conv,
      profile: profileMap[conv.user_id],
    }));
    setConversations(withUser);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadMessages = async (conv: ConversationWithUser) => {
    setSelected(conv);
    setMessagesLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setMessagesLoading(false);
  };

  const restore = async (id: string) => {
    await supabase.from('conversations').update({ deleted_at: null }).eq('id', id);
    load();
    if (selected?.id === id) {
      setSelected(prev => prev ? { ...prev, deleted_at: null } : prev);
    }
  };

  const hardDelete = async (id: string) => {
    if (!confirm('Permanently delete this conversation and all its messages? This cannot be undone.')) return;
    await supabase.from('conversations').delete().eq('id', id);
    if (selected?.id === id) {
      setSelected(null);
      setMessages([]);
    }
    load();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter(c => {
      if (filter === 'active' && c.deleted_at) return false;
      if (filter === 'deleted' && !c.deleted_at) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.profile?.email?.toLowerCase().includes(q) ||
        c.profile?.full_name?.toLowerCase().includes(q)
      );
    });
  }, [conversations, query, filter]);

  if (selected) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setSelected(null); setMessages([]); }}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to all conversations
        </button>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
            <div>
              <h3 className="text-white font-semibold text-lg">{selected.title}</h3>
              <div className="text-sm text-slate-400 mt-1">
                {selected.profile?.full_name || '(no name)'} &middot; {selected.profile?.email}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selected.deleted_at && (
                <button
                  onClick={() => restore(selected.id)}
                  className="text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-3 py-1.5"
                >
                  Restore
                </button>
              )}
              <button
                onClick={() => hardDelete(selected.id)}
                className="text-sm bg-red-600/90 hover:bg-red-500 text-white rounded-lg px-3 py-1.5 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Purge
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Created {new Date(selected.created_at).toLocaleString()}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Updated {new Date(selected.updated_at).toLocaleString()}</span>
            {selected.deleted_at && (
              <span className="flex items-center gap-1 text-red-400">
                <AlertTriangle className="w-3 h-3" />
                Deleted by user {new Date(selected.deleted_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5">
          {messagesLoading ? (
            <div className="text-slate-400 text-sm">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="text-slate-500 text-sm text-center py-8">No messages in this conversation.</div>
          ) : (
            <div className="space-y-4">
              {messages.map(m => (
                <div key={m.id} className="flex gap-3">
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                    m.role === 'user'
                      ? 'bg-gradient-to-br from-emerald-400 to-teal-600'
                      : 'bg-slate-700'
                  }`}>
                    {m.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white capitalize">{m.role}</span>
                      <span className="text-xs text-slate-500">{new Date(m.created_at).toLocaleString()}</span>
                      {m.tokens_used > 0 && (
                        <span className="text-xs text-slate-500">&middot; {m.tokens_used} tokens</span>
                      )}
                    </div>
                    <div className="text-sm text-slate-200 whitespace-pre-wrap break-words">
                      {m.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-sm text-amber-200 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          Admins have full access to every customer conversation, including chats
          users have deleted from their sidebar. Handle this data with care.
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by title, user email, or name..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg pl-9 pr-3 py-2"
          />
        </div>
        <div className="flex gap-1 bg-slate-900 border border-slate-700 rounded-lg p-1">
          {(['all', 'active', 'deleted'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-md capitalize transition ${
                filter === f ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">Loading conversations...</div>
      ) : filtered.length === 0 ? (
        <div className="text-slate-500 text-sm text-center py-12">No conversations match your filters.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(conv => (
            <button
              key={conv.id}
              onClick={() => loadMessages(conv)}
              className={`w-full text-left bg-slate-800/60 border rounded-xl p-4 flex items-center gap-3 hover:bg-slate-800 transition ${
                conv.deleted_at ? 'border-red-500/30' : 'border-slate-700/60'
              }`}
            >
              <MessageSquare className={`w-5 h-5 flex-shrink-0 ${conv.deleted_at ? 'text-red-400' : 'text-emerald-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-medium truncate">{conv.title}</span>
                  {conv.deleted_at && (
                    <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded">Deleted</span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">
                  {conv.profile?.email || 'Unknown user'}
                  {conv.profile?.full_name ? ` — ${conv.profile.full_name}` : ''}
                </div>
              </div>
              <div className="text-xs text-slate-500 flex-shrink-0 hidden sm:block">
                {new Date(conv.updated_at).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
