import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthPage from './pages/AuthPage';
import ChatSidebar from './components/ChatSidebar';
import ThemeToggle from './components/ThemeToggle';
import ChatView from './components/ChatView';
import InstallPrompt from './components/InstallPrompt';
import BillingPage from './pages/BillingPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import { supabase, Conversation, AITool } from './lib/supabase';
import { Sparkles } from 'lucide-react';

type View = 'chat' | 'billing' | 'admin' | 'settings';

function AppShell() {
  const { profile, loading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tools, setTools] = useState<AITool[]>([]);
  const [view, setView] = useState<View>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    loadConversations();
    loadTools();
  }, [profile?.id]);

  const loadConversations = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', profile.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    setConversations(data || []);
  };

  const loadTools = async () => {
    const { data } = await supabase
      .from('ai_tools')
      .select('*')
      .eq('is_active', true)
      .order('created_at');
    setTools(data || []);
  };

  const handleNewChat = () => {
    setActiveId(null);
    setSidebarOpen(false);
  };

  const handleSelect = (id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
  };

  const handleDelete = async (id: string) => {
    await supabase
      .from('conversations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (activeId === id) setActiveId(null);
    setConversations(prev => prev.filter(c => c.id !== id));
  };

  const handleConvCreated = (conv: Conversation) => {
    setActiveId(conv.id);
    setConversations(prev => [conv, ...prev]);
  };

  const handleConvUpdated = (conv: Conversation) => {
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== conv.id);
      return [conv, ...filtered];
    });
  };

  const handleNavigate = (v: View) => {
    setView(v);
    setSidebarOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <ThemeToggle />
        <div className="flex items-center gap-3 text-white">
          <Sparkles className="w-6 h-6 text-emerald-400 animate-pulse" />
          <span className="text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <>
        <ThemeToggle />
        <AuthPage />
      </>
    );
  }

  const activeConv = conversations.find(c => c.id === activeId) || null;

  return (
    <div className="h-screen flex bg-slate-900 overflow-hidden">
      <ThemeToggle />
      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelect}
        onNew={handleNewChat}
        onDelete={handleDelete}
        onNavigate={handleNavigate}
        currentView={view}
        mobileOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
      />
      {view === 'chat' && (
        <ChatView
          conversation={activeConv}
          tools={tools}
          onOpenSidebar={() => setSidebarOpen(true)}
          onConversationCreated={handleConvCreated}
          onConversationUpdated={handleConvUpdated}
        />
      )}
      {view === 'billing' && <BillingPage onOpenSidebar={() => setSidebarOpen(true)} />}
      {view === 'settings' && <SettingsPage onOpenSidebar={() => setSidebarOpen(true)} />}
      {view === 'admin' && profile.role === 'admin' && <AdminPage onOpenSidebar={() => setSidebarOpen(true)} />}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
        <InstallPrompt />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
