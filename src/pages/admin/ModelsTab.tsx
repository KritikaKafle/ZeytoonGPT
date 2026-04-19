import { useEffect, useState } from 'react';
import { Plus, Bot } from 'lucide-react';
import { supabase, AITool, ApiProvider } from '../../lib/supabase';
import ModelDetail from './ModelDetail';

export default function ModelsTab() {
  const [tools, setTools] = useState<AITool[]>([]);
  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [t, p] = await Promise.all([
      supabase.from('ai_tools').select('*').order('created_at'),
      supabase.from('api_providers').select('*').order('created_at'),
    ]);
    setTools(t.data || []);
    setProviders(p.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addModel = async () => {
    const slug = `model-${Date.now()}`;
    const { data } = await supabase
      .from('ai_tools')
      .insert({
        name: slug,
        display_name: 'New Model',
        description: '',
        azure_deployment_name: '',
        model_id: 'gpt-4o-mini',
        system_prompt: '',
        icon_url: '',
        tags: [],
        model_params: { temperature: 0.7, max_tokens: 1500 },
        is_active: true,
      })
      .select()
      .maybeSingle();
    if (data) {
      setEditingId(data.id);
    }
    load();
  };

  if (editingId) {
    const tool = tools.find(t => t.id === editingId);
    if (tool) {
      return (
        <ModelDetail
          tool={tool}
          providers={providers}
          onBack={() => { setEditingId(null); load(); }}
          onDeleted={() => { setEditingId(null); load(); }}
        />
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Models</h2>
          <p className="text-sm text-slate-400">Define models users can chat with. Each has its own name, icon, system prompt, and parameters.</p>
        </div>
        <button
          onClick={addModel}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg px-3 py-2"
        >
          <Plus className="w-4 h-4" /> New Model
        </button>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Loading...</div>
      ) : tools.length === 0 ? (
        <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-2xl p-10 text-center">
          <Bot className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No models yet. Create your first one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map(t => {
            const provider = providers.find(p => p.id === t.provider_id);
            return (
              <button
                key={t.id}
                onClick={() => setEditingId(t.id)}
                className="text-left bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-emerald-500/40 rounded-2xl p-4 transition group"
              >
                <div className="flex items-start gap-3">
                  <ModelAvatar url={t.icon_url} name={t.display_name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-semibold truncate">{t.display_name}</h3>
                      {!t.is_active && (
                        <span className="text-[10px] uppercase tracking-wide bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">Off</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{t.model_id || t.azure_deployment_name || 'no model id'}</p>
                    {t.description && (
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">{t.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap mt-3">
                      {(t.tags || []).slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                      {provider && (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          {provider.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModelAvatar({ url, name }: { url: string; name: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="w-12 h-12 rounded-xl object-cover bg-slate-900 border border-slate-700"
      />
    );
  }
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold">
      {initial}
    </div>
  );
}
