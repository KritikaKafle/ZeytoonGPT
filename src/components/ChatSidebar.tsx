import { Plus, MessageSquare, Trash2, Sparkles, LogOut, Settings, CreditCard, Shield, X } from 'lucide-react';
import { Conversation } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type Props = {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onNavigate: (view: 'chat' | 'billing' | 'admin' | 'settings') => void;
  currentView: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export default function ChatSidebar({
  conversations, activeId, onSelect, onNew, onDelete,
  onNavigate, currentView, mobileOpen, onCloseMobile,
}: Props) {
  const { profile, signOut } = useAuth();

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={onCloseMobile} />
      )}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-40 w-72 bg-slate-950 border-r border-slate-800
        flex flex-col transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
              <img src="/zeytoongpt.png" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-white font-semibold">ZeytoonGPT</span>
          </div>
          <button onClick={onCloseMobile} className="md:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3">
          <button
            onClick={() => { onNew(); onNavigate('chat'); }}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-medium rounded-xl py-2.5 flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <div className="text-xs font-medium text-slate-500 px-2 py-2 uppercase tracking-wider">Recent</div>
          {conversations.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-8 px-4">
              No conversations yet. Start a new chat!
            </div>
          )}
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => { onSelect(conv.id); onNavigate('chat'); }}
              className={`group w-full text-left rounded-lg px-3 py-2 mb-1 flex items-center gap-2 transition ${
                activeId === conv.id && currentView === 'chat'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0" />
              <span className="truncate text-sm flex-1">{conv.title}</span>
              <span
                onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
        </div>

        <div className="border-t border-slate-800 p-3 space-y-1">
          <button
            onClick={() => onNavigate('billing')}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
              currentView === 'billing' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Subscription
          </button>
          <button
            onClick={() => onNavigate('settings')}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
              currentView === 'settings' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            Usage & Settings
          </button>
          {profile?.role === 'admin' && (
            <button
              onClick={() => onNavigate('admin')}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                currentView === 'admin' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              Admin Panel
            </button>
          )}
          <div className="pt-2 mt-2 border-t border-slate-800 flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-sm font-semibold">
              {profile?.full_name?.charAt(0)?.toUpperCase() || profile?.email.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">{profile?.full_name || 'User'}</div>
              <div className="text-xs text-slate-500 truncate">{profile?.email}</div>
            </div>
            <button
              onClick={signOut}
              className="text-slate-500 hover:text-red-400 transition"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
