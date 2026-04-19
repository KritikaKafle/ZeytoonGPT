import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, Eye, EyeOff, Server } from 'lucide-react';
import { supabase, ApiProvider } from '../../lib/supabase';

export default function ProvidersTab() {
  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('api_providers').select('*').order('created_at', { ascending: true });
    setProviders(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    await supabase.from('api_providers').insert({
      name: 'New Provider',
      provider_type: 'openai',
      base_url: 'https://api.openai.com/v1',
      api_key: '',
      is_active: true,
    });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this provider? Models using it will have no API access until reassigned.')) return;
    await supabase.from('api_providers').delete().eq('id', id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">API Providers</h2>
          <p className="text-sm text-slate-400">Configure OpenAI-compatible, Azure OpenAI, or custom endpoints.</p>
        </div>
        <button
          onClick={add}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg px-3 py-2"
        >
          <Plus className="w-4 h-4" /> New Provider
        </button>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Loading...</div>
      ) : providers.length === 0 ? (
        <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-2xl p-10 text-center">
          <Server className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No providers yet. Add one to connect an API.</p>
        </div>
      ) : (
        providers.map(p => <ProviderCard key={p.id} provider={p} onChanged={load} onDelete={() => remove(p.id)} />)
      )}
    </div>
  );
}

function ProviderCard({ provider, onChanged, onDelete }: {
  provider: ApiProvider; onChanged: () => void; onDelete: () => void;
}) {
  const [draft, setDraft] = useState<ApiProvider>(provider);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDraft(provider); }, [provider.id]);

  const save = async () => {
    setSaving(true);
    await supabase
      .from('api_providers')
      .update({
        name: draft.name,
        provider_type: draft.provider_type,
        base_url: draft.base_url,
        api_key: draft.api_key,
        api_version: draft.api_version,
        is_active: draft.is_active,
      })
      .eq('id', provider.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onChanged();
  };

  const typeHint: Record<string, string> = {
    'openai': 'e.g. https://api.openai.com/v1',
    'azure-openai': 'e.g. https://my-resource.openai.azure.com',
    'anthropic': 'e.g. https://api.anthropic.com/v1',
    'custom': 'Full base URL for OpenAI-compatible API',
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Display Name">
          <input
            value={draft.name}
            onChange={e => setDraft({ ...draft, name: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
          />
        </Field>
        <Field label="Provider Type">
          <select
            value={draft.provider_type}
            onChange={e => setDraft({ ...draft, provider_type: e.target.value as ApiProvider['provider_type'] })}
            className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
          >
            <option value="openai">OpenAI (and compatible)</option>
            <option value="azure-openai">Azure OpenAI</option>
            <option value="custom">Custom (OpenAI-compatible)</option>
          </select>
        </Field>
        <Field label="Base URL" hint={typeHint[draft.provider_type]}>
          <input
            value={draft.base_url}
            onChange={e => setDraft({ ...draft, base_url: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
          />
        </Field>
        <Field label="API Key">
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={draft.api_key}
              onChange={e => setDraft({ ...draft, api_key: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>
        {draft.provider_type === 'azure-openai' && (
          <Field label="API Version" hint="e.g. 2024-02-15-preview">
            <input
              value={draft.api_version}
              onChange={e => setDraft({ ...draft, api_version: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
            />
          </Field>
        )}
        <Field label="Status">
          <label className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={e => setDraft({ ...draft, is_active: e.target.checked })}
              className="accent-emerald-500"
            />
            <span className="text-sm text-white">{draft.is_active ? 'Active' : 'Disabled'}</span>
          </label>
        </Field>
      </div>

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-700/60">
        <button
          onClick={onDelete}
          className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1.5"
        >
          <Trash2 className="w-4 h-4" /> Delete
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm rounded-lg px-4 py-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}
