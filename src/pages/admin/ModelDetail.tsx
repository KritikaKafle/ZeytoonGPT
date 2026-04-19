import { useState } from 'react';
import { ArrowLeft, Save, Trash2, Image as ImageIcon, RotateCcw, X } from 'lucide-react';
import { supabase, AITool, ApiProvider } from '../../lib/supabase';

type Props = {
  tool: AITool;
  providers: ApiProvider[];
  onBack: () => void;
  onDeleted: () => void;
};

export default function ModelDetail({ tool, providers, onBack, onDeleted }: Props) {
  const [draft, setDraft] = useState<AITool>({
    ...tool,
    tags: tool.tags || [],
    model_params: tool.model_params || {},
  });
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (patch: Partial<AITool>) => setDraft(d => ({ ...d, ...patch }));
  const updateParams = (patch: Record<string, number | undefined>) =>
    setDraft(d => ({ ...d, model_params: { ...d.model_params, ...patch } }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('ai_tools')
      .update({
        name: draft.name,
        display_name: draft.display_name,
        description: draft.description,
        azure_deployment_name: draft.azure_deployment_name,
        is_active: draft.is_active,
        provider_id: draft.provider_id,
        model_id: draft.model_id,
        system_prompt: draft.system_prompt,
        icon_url: draft.icon_url,
        tags: draft.tags,
        model_params: draft.model_params,
      })
      .eq('id', tool.id);
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } else {
      alert(error.message);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete "${draft.display_name}"? This cannot be undone.`)) return;
    await supabase.from('ai_tools').delete().eq('id', tool.id);
    onDeleted();
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!draft.tags.includes(t)) update({ tags: [...draft.tags, t] });
    setTagInput('');
  };

  const removeTag = (t: string) => update({ tags: draft.tags.filter(x => x !== t) });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update({ icon_url: reader.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={onBack} className="text-slate-300 hover:text-white flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={remove}
            className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-sm px-3 py-2 rounded-lg hover:bg-red-500/10"
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

      <div className="grid grid-cols-1 md:grid-cols-[220px,1fr] gap-6">
        <div>
          <div className="relative group">
            {draft.icon_url ? (
              <img
                src={draft.icon_url}
                alt={draft.display_name}
                className="w-full aspect-square rounded-2xl object-cover bg-slate-800 border border-slate-700"
              />
            ) : (
              <div className="w-full aspect-square rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-6xl font-bold border border-slate-700">
                {(draft.display_name || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <label className="absolute bottom-3 right-3 bg-slate-900/90 hover:bg-slate-900 border border-slate-700 text-white rounded-full p-2 cursor-pointer">
              <ImageIcon className="w-4 h-4" />
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </label>
          </div>
          {draft.icon_url && (
            <button
              onClick={() => update({ icon_url: '' })}
              className="mt-2 w-full text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reset Image
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <input
              value={draft.display_name}
              onChange={e => update({ display_name: e.target.value })}
              placeholder="Display name"
              className="w-full bg-transparent text-white text-3xl font-bold focus:outline-none border-b border-transparent hover:border-slate-700 focus:border-emerald-500 py-1"
            />
            <input
              value={draft.model_id}
              onChange={e => update({ model_id: e.target.value })}
              placeholder="model-id (e.g. gpt-4o-mini)"
              className="w-full bg-transparent text-slate-400 text-sm focus:outline-none border-b border-transparent hover:border-slate-700 focus:border-emerald-500 py-1 mt-1"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Description</label>
            <input
              value={draft.description}
              onChange={e => update({ description: e.target.value })}
              placeholder="Short description shown in the model picker"
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Tags</label>
            <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2">
              {draft.tags.map(t => (
                <span key={t} className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-full px-2.5 py-0.5 text-xs">
                  {t}
                  <button onClick={() => removeTag(t)} className="hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
                onBlur={addTag}
                placeholder="Add a tag..."
                className="flex-1 min-w-[120px] bg-transparent text-white text-sm focus:outline-none px-1"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">Connection</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">API Provider</label>
            <select
              value={draft.provider_id || ''}
              onChange={e => update({ provider_id: e.target.value || null })}
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
            >
              <option value="">-- none --</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.provider_type})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Azure Deployment Name</label>
            <input
              value={draft.azure_deployment_name}
              onChange={e => update({ azure_deployment_name: e.target.value })}
              placeholder="Only used for Azure OpenAI (optional fallback)"
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Internal Name (slug)</label>
            <input
              value={draft.name}
              onChange={e => update({ name: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Status</label>
            <label className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={e => update({ is_active: e.target.checked })}
                className="accent-emerald-500"
              />
              <span className="text-sm text-white">{draft.is_active ? 'Active (visible to users)' : 'Disabled'}</span>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Model Params</h3>
          <p className="text-xs text-slate-500">Leave blank to use model defaults.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <NumField label="Temperature" step="0.1" value={draft.model_params.temperature} onChange={v => updateParams({ temperature: v })} />
          <NumField label="Max Tokens" step="1" value={draft.model_params.max_tokens} onChange={v => updateParams({ max_tokens: v })} />
          <NumField label="Top P" step="0.05" value={draft.model_params.top_p} onChange={v => updateParams({ top_p: v })} />
          <NumField label="Freq Penalty" step="0.1" value={draft.model_params.frequency_penalty} onChange={v => updateParams({ frequency_penalty: v })} />
          <NumField label="Pres Penalty" step="0.1" value={draft.model_params.presence_penalty} onChange={v => updateParams({ presence_penalty: v })} />
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-1">System Prompt</h3>
        <p className="text-xs text-slate-500 mb-3">Injected as the first system message in every conversation with this model.</p>
        <textarea
          value={draft.system_prompt}
          onChange={e => update({ system_prompt: e.target.value })}
          rows={14}
          placeholder={`You are ${draft.display_name || '...'}, an AI assistant...\n\nBehavior rules:\n- ...\n\nIdentity response rules:\n- ...`}
          className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-3 font-mono leading-relaxed resize-y focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, step }: {
  label: string; value: number | undefined; onChange: (v: number | undefined) => void; step: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-400 mb-1 uppercase tracking-wide">{label}</label>
      <input
        type="number"
        step={step}
        value={value ?? ''}
        onChange={e => {
          const v = e.target.value;
          onChange(v === '' ? undefined : Number(v));
        }}
        className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
      />
    </div>
  );
}
