import { useEffect, useState } from 'react';
import { Menu, Users, Shield, CreditCard as Edit2, Save, X, Bot, Server, MessageSquare, UserPlus, Plus, Trash2, DollarSign } from 'lucide-react';
import { supabase, Profile, AITool, SubscriptionPlan, UserToolOverride, TokenUsage } from '../lib/supabase';
import ModelsTab from './admin/ModelsTab';
import ProvidersTab from './admin/ProvidersTab';
import ChatHistoryTab from './admin/ChatHistoryTab';

type Props = { onOpenSidebar: () => void };

type Tab = 'users' | 'plans' | 'models' | 'providers' | 'chats';

export default function AdminPage({ onOpenSidebar }: Props) {
  const [tab, setTab] = useState<Tab>('models');

  return (
    <div className="flex-1 overflow-y-auto bg-slate-900">
      <header className="border-b border-slate-800 px-4 py-3 flex items-center gap-3 sticky top-0 bg-slate-900 z-10">
        <button onClick={onOpenSidebar} className="md:hidden text-slate-400 hover:text-white">
          <Menu className="w-5 h-5" />
        </button>
        <Shield className="w-5 h-5 text-emerald-400" />
        <h1 className="text-xl font-semibold text-white">Admin Panel</h1>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6 border-b border-slate-800 flex-wrap">
          <TabBtn active={tab === 'models'} onClick={() => setTab('models')} label="Models" icon={Bot} />
          <TabBtn active={tab === 'providers'} onClick={() => setTab('providers')} label="API Providers" icon={Server} />
          <TabBtn active={tab === 'users'} onClick={() => setTab('users')} label="Users" icon={Users} />
          <TabBtn active={tab === 'plans'} onClick={() => setTab('plans')} label="Plan Limits" icon={Edit2} />
          <TabBtn active={tab === 'chats'} onClick={() => setTab('chats')} label="Chat History" icon={MessageSquare} />
        </div>

        {tab === 'models' && <ModelsTab />}
        {tab === 'providers' && <ProvidersTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'plans' && <PlansTab />}
        {tab === 'chats' && <ChatHistoryTab />}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, label, icon: Icon }: { active: boolean; onClick: () => void; label: string; icon: any }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
        active
          ? 'text-emerald-400 border-emerald-400'
          : 'text-slate-400 border-transparent hover:text-white'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [tools, setTools] = useState<AITool[]>([]);
  const [overrides, setOverrides] = useState<UserToolOverride[]>([]);
  const [usage, setUsage] = useState<TokenUsage[]>([]);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    const [u, p, t, o, us] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('subscription_plans').select('*').order('sort_order'),
      supabase.from('ai_tools').select('*'),
      supabase.from('user_tool_overrides').select('*'),
      supabase.from('token_usage').select('*'),
    ]);
    setUsers(u.data || []);
    setPlans(p.data || []);
    setTools(t.data || []);
    setOverrides(o.data || []);
    setUsage(us.data || []);
  };

  useEffect(() => { load(); }, []);

  const updateUser = async (id: string, updates: Partial<Profile>) => {
    await supabase.from('profiles').update(updates).eq('id', id);
    load();
  };

  const setOverride = async (userId: string, toolId: string, value: number | null) => {
    if (value === null) {
      await supabase.from('user_tool_overrides').delete().eq('user_id', userId).eq('tool_id', toolId);
    } else {
      const existing = overrides.find(o => o.user_id === userId && o.tool_id === toolId);
      if (existing) {
        await supabase.from('user_tool_overrides').update({ monthly_token_limit: value }).eq('id', existing.id);
      } else {
        await supabase.from('user_tool_overrides').insert({ user_id: userId, tool_id: toolId, monthly_token_limit: value });
      }
    }
    load();
  };

  const getUserUsage = (userId: string, toolId: string) =>
    usage.find(u => u.user_id === userId && u.tool_id === toolId)?.tokens_used ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-slate-400">
          {users.length} user{users.length === 1 ? '' : 's'} total
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg px-3.5 py-2 transition shadow-lg shadow-emerald-500/20"
        >
          <UserPlus className="w-4 h-4" />
          Create User
        </button>
      </div>
      {showCreate && (
        <CreateUserModal
          plans={plans}
          tools={tools}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
      {users.map(user => {
        const userOverrides = overrides.filter(o => o.user_id === user.id);
        const isEditing = editingUser === user.id;
        return (
          <div key={user.id} className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <div>
                <div className="text-white font-semibold">{user.full_name || '(no name)'}</div>
                <div className="text-sm text-slate-400">{user.email}</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={user.subscription_plan_id || ''}
                  onChange={e => updateUser(user.id, { subscription_plan_id: e.target.value || null })}
                  className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5"
                >
                  <option value="">No plan</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select
                  value={user.role}
                  onChange={e => updateUser(user.id, { role: e.target.value as 'user' | 'admin' })}
                  className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  onClick={() => setEditingUser(isEditing ? null : user.id)}
                  className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                  {isEditing ? 'Close' : 'Limits'}
                </button>
              </div>
            </div>
            {isEditing && (
              <div className="mt-4 pt-4 border-t border-slate-700/60 grid grid-cols-1 md:grid-cols-3 gap-3">
                {tools.map(tool => {
                  const ov = userOverrides.find(o => o.tool_id === tool.id);
                  return (
                    <OverrideEditor
                      key={tool.id}
                      tool={tool}
                      override={ov}
                      used={getUserUsage(user.id, tool.id)}
                      onSave={(v) => setOverride(user.id, tool.id, v)}
                      onClear={() => setOverride(user.id, tool.id, null)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OverrideEditor({ tool, override, used, onSave, onClear }: {
  tool: AITool; override?: UserToolOverride; used: number;
  onSave: (v: number) => void; onClear: () => void;
}) {
  const [val, setVal] = useState<string>(override?.monthly_token_limit?.toString() ?? '');
  return (
    <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3">
      <div className="text-sm text-white font-medium mb-1">{tool.display_name}</div>
      <div className="text-xs text-slate-500 mb-2">Used: {used.toLocaleString()} tokens</div>
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Use plan default"
          value={val}
          onChange={e => setVal(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-2 py-1.5 min-w-0"
        />
        <button
          onClick={() => onSave(val === '' ? 0 : parseInt(val))}
          className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-2 py-1.5"
          title="Save"
        >
          <Save className="w-3.5 h-3.5" />
        </button>
        {override && (
          <button
            onClick={onClear}
            className="bg-slate-700 hover:bg-slate-600 text-white rounded-lg px-2 py-1.5"
            title="Clear override"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="text-xs text-slate-500 mt-1">-1 = unlimited</div>
    </div>
  );
}

function PlansTab() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [tools, setTools] = useState<AITool[]>([]);
  const [limits, setLimits] = useState<any[]>([]);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const [p, t, l] = await Promise.all([
      supabase.from('subscription_plans').select('*').order('sort_order'),
      supabase.from('ai_tools').select('*'),
      supabase.from('plan_tool_limits').select('*'),
    ]);
    setPlans(p.data || []);
    setTools(t.data || []);
    setLimits(l.data || []);
  };

  useEffect(() => { load(); }, []);

  const updateLimit = async (planId: string, toolId: string, value: number) => {
    const existing = limits.find(l => l.plan_id === planId && l.tool_id === toolId);
    if (existing) {
      await supabase.from('plan_tool_limits').update({ monthly_token_limit: value }).eq('id', existing.id);
    } else {
      await supabase.from('plan_tool_limits').insert({ plan_id: planId, tool_id: toolId, monthly_token_limit: value });
    }
    load();
  };

  const savePlan = async (plan: SubscriptionPlan) => {
    const { id, ...rest } = plan;
    await supabase.from('subscription_plans').update(rest).eq('id', id);
    setEditingPlanId(null);
    load();
  };

  const createPlan = async (plan: Omit<SubscriptionPlan, 'id'>) => {
    await supabase.from('subscription_plans').insert(plan);
    setCreating(false);
    load();
  };

  const deletePlan = async (id: string) => {
    if (!confirm('Delete this plan? Users on it will be unassigned.')) return;
    await supabase.from('subscription_plans').delete().eq('id', id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-slate-400">Manage plans, pricing, features, and per-tool token limits. Use -1 for unlimited tokens.</p>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg px-3.5 py-2 transition shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" />
          New Plan
        </button>
      </div>

      {creating && (
        <PlanEditor
          initial={{
            name: '',
            price_monthly: 0,
            price_yearly: 0,
            currency: 'USD',
            description: '',
            features: [],
            is_active: true,
            sort_order: plans.length,
          }}
          onSave={(p) => createPlan(p as Omit<SubscriptionPlan, 'id'>)}
          onCancel={() => setCreating(false)}
        />
      )}

      {plans.map(plan => (
        <div key={plan.id} className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5">
          {editingPlanId === plan.id ? (
            <PlanEditor
              initial={plan}
              onSave={(p) => savePlan({ ...plan, ...p })}
              onCancel={() => setEditingPlanId(null)}
            />
          ) : (
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-white font-semibold text-lg">{plan.name}</h3>
                  {!plan.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">Inactive</span>
                  )}
                </div>
                {plan.description && <p className="text-sm text-slate-400 mt-1">{plan.description}</p>}
                <div className="flex items-center gap-4 mt-2 text-sm text-slate-300">
                  <span>{formatPrice(plan.price_monthly, plan.currency)} <span className="text-slate-500">/ month</span></span>
                  <span>{formatPrice(plan.price_yearly, plan.currency)} <span className="text-slate-500">/ year</span></span>
                </div>
                {plan.features?.length > 0 && (
                  <ul className="mt-3 text-xs text-slate-400 list-disc list-inside space-y-0.5">
                    {plan.features.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingPlanId(plan.id)}
                  className="flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 bg-slate-900 border border-slate-700 hover:border-emerald-500/50 rounded-lg px-3 py-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => deletePlan(plan.id)}
                  className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 bg-slate-900 border border-slate-700 hover:border-red-500/50 rounded-lg px-3 py-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-700/60">
            <div className="text-sm text-slate-300 font-medium mb-3">Token limits per tool</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {tools.map(tool => {
                const lim = limits.find(l => l.plan_id === plan.id && l.tool_id === tool.id);
                return (
                  <LimitEditor
                    key={tool.id}
                    tool={tool}
                    value={lim?.monthly_token_limit ?? 0}
                    onSave={(v) => updateLimit(plan.id, tool.id, v)}
                  />
                );
              })}
              {tools.length === 0 && (
                <div className="text-xs text-slate-500">No tools configured.</div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatPrice(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(Number(value) || 0);
  } catch {
    return `${currency || ''} ${value}`;
  }
}

function PlanEditor({ initial, onSave, onCancel }: {
  initial: Partial<SubscriptionPlan>;
  onSave: (plan: Partial<SubscriptionPlan>) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [priceMonthly, setPriceMonthly] = useState(String(initial.price_monthly ?? 0));
  const [priceYearly, setPriceYearly] = useState(String(initial.price_yearly ?? 0));
  const [currency, setCurrency] = useState(initial.currency ?? 'USD');
  const [sortOrder, setSortOrder] = useState(String(initial.sort_order ?? 0));
  const [isActive, setIsActive] = useState(initial.is_active ?? true);
  const [features, setFeatures] = useState<string[]>(initial.features ?? []);
  const [newFeature, setNewFeature] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      description: description.trim(),
      price_monthly: parseFloat(priceMonthly) || 0,
      price_yearly: parseFloat(priceYearly) || 0,
      currency: currency.trim().toUpperCase() || 'USD',
      sort_order: parseInt(sortOrder) || 0,
      is_active: isActive,
      features,
    });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Plan name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
            placeholder="Pro"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Sort order</label>
          <input
            type="number"
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
            placeholder="Short tagline shown on billing page"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Monthly price</label>
          <div className="relative">
            <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="number" step="0.01" min="0"
              value={priceMonthly}
              onChange={e => setPriceMonthly(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg pl-9 pr-3 py-2"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Yearly price</label>
          <div className="relative">
            <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="number" step="0.01" min="0"
              value={priceYearly}
              onChange={e => setPriceYearly(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg pl-9 pr-3 py-2"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Currency</label>
          <input
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            maxLength={3}
            className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 uppercase"
            placeholder="USD"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-500"
            />
            Active (visible to users)
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Features</label>
        <div className="space-y-2">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={f}
                onChange={e => setFeatures(features.map((x, j) => j === i ? e.target.value : x))}
                className="flex-1 bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
              />
              <button
                onClick={() => setFeatures(features.filter((_, j) => j !== i))}
                className="p-2 text-red-400 hover:text-red-300 bg-slate-900 border border-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input
              value={newFeature}
              onChange={e => setNewFeature(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newFeature.trim()) {
                  e.preventDefault();
                  setFeatures([...features, newFeature.trim()]);
                  setNewFeature('');
                }
              }}
              placeholder="Add a feature and press Enter"
              className="flex-1 bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
            />
            <button
              onClick={() => {
                if (newFeature.trim()) {
                  setFeatures([...features, newFeature.trim()]);
                  setNewFeature('');
                }
              }}
              className="p-2 text-emerald-400 hover:text-emerald-300 bg-slate-900 border border-slate-700 rounded-lg"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/60">
        <button onClick={onCancel} className="text-sm text-slate-300 hover:text-white px-4 py-2 rounded-lg">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save plan'}
        </button>
      </div>
    </div>
  );
}

function LimitEditor({ tool, value, onSave }: { tool: AITool; value: number; onSave: (v: number) => void }) {
  const [val, setVal] = useState(value.toString());
  useEffect(() => { setVal(value.toString()); }, [value]);
  return (
    <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3">
      <div className="text-sm text-white font-medium mb-2">{tool.display_name}</div>
      <div className="flex gap-2">
        <input
          type="number"
          value={val}
          onChange={e => setVal(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-2 py-1.5 min-w-0"
        />
        <button
          onClick={() => onSave(parseInt(val) || 0)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-3 py-1.5 text-sm"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function CreateUserModal({ plans, tools, onClose, onCreated }: {
  plans: SubscriptionPlan[];
  tools: AITool[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [planId, setPlanId] = useState<string>('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) { setError('Not authenticated'); setSubmitting(false); return; }

      const toolOverrides = Object.entries(overrides)
        .filter(([, v]) => v !== '' && !Number.isNaN(parseInt(v)))
        .map(([tool_id, v]) => ({ tool_id, monthly_token_limit: parseInt(v) }));

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          role,
          subscription_plan_id: planId || null,
          tool_overrides: toolOverrides,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || 'Failed to create user');
      } else {
        onCreated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-400" />
            Create User
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
              <input
                type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Temporary Password</label>
              <input
                type="text" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 font-mono"
                placeholder="Min 6 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
              <select
                value={role} onChange={e => setRole(e.target.value as 'user' | 'admin')}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1">Subscription Plan</label>
              <select
                value={planId} onChange={e => setPlanId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
              >
                <option value="">Default (Free)</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name} — ${p.price_monthly}/mo</option>)}
              </select>
            </div>
          </div>

          <div className="pt-2">
            <div className="text-sm font-medium text-slate-300 mb-2">Token Limit Overrides (optional)</div>
            <div className="text-xs text-slate-500 mb-3">
              Leave empty to use the plan's default. Enter -1 for unlimited.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tools.map(tool => (
                <div key={tool.id} className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
                  <div className="text-sm text-white font-medium mb-2">{tool.display_name}</div>
                  <input
                    type="number"
                    value={overrides[tool.id] ?? ''}
                    onChange={e => setOverrides(prev => ({ ...prev, [tool.id]: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-2 py-1.5"
                    placeholder="Use plan default"
                  />
                </div>
              ))}
              {tools.length === 0 && (
                <div className="text-xs text-slate-500">No tools configured.</div>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button type="button" onClick={onClose}
              className="text-sm text-slate-300 hover:text-white px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
