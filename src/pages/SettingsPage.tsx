import { useEffect, useState } from 'react';
import { Menu, Activity, TrendingUp } from 'lucide-react';
import { supabase, AITool, TokenUsage, PlanToolLimit, UserToolOverride, SubscriptionPlan } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type Props = { onOpenSidebar: () => void };

export default function SettingsPage({ onOpenSidebar }: Props) {
  const { profile } = useAuth();
  const [tools, setTools] = useState<AITool[]>([]);
  const [usage, setUsage] = useState<TokenUsage[]>([]);
  const [limits, setLimits] = useState<PlanToolLimit[]>([]);
  const [overrides, setOverrides] = useState<UserToolOverride[]>([]);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const periodStart = new Date();
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
      const ps = periodStart.toISOString().slice(0, 10);
      const [toolsRes, usageRes, limitsRes, overridesRes, planRes] = await Promise.all([
        supabase.from('ai_tools').select('*').eq('is_active', true),
        supabase.from('token_usage').select('*').eq('user_id', profile.id).eq('period_start', ps),
        supabase.from('plan_tool_limits').select('*').eq('plan_id', profile.subscription_plan_id || ''),
        supabase.from('user_tool_overrides').select('*').eq('user_id', profile.id),
        profile.subscription_plan_id
          ? supabase.from('subscription_plans').select('*').eq('id', profile.subscription_plan_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setTools(toolsRes.data || []);
      setUsage(usageRes.data || []);
      setLimits(limitsRes.data || []);
      setOverrides(overridesRes.data || []);
      setPlan(planRes.data);
    })();
  }, [profile]);

  const getLimit = (toolId: string) => {
    const ov = overrides.find(o => o.tool_id === toolId);
    if (ov) return ov.monthly_token_limit;
    return limits.find(l => l.tool_id === toolId)?.monthly_token_limit ?? 0;
  };

  const getUsed = (toolId: string) =>
    usage.find(u => u.tool_id === toolId)?.tokens_used ?? 0;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-900">
      <header className="border-b border-slate-800 px-4 py-3 flex items-center gap-3 sticky top-0 bg-slate-900 z-10">
        <button onClick={onOpenSidebar} className="md:hidden text-slate-400 hover:text-white">
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold text-white">Usage & Settings</h1>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Account</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <Field label="Full name" value={profile?.full_name || '-'} />
            <Field label="Email" value={profile?.email || '-'} />
            <Field label="Current Plan" value={plan?.name || 'Free'} />
            <Field label="Status" value={profile?.subscription_status || '-'} />
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">This Month's Usage</h2>
          </div>
          <div className="space-y-5">
            {tools.map(tool => {
              const limit = getLimit(tool.id);
              const used = getUsed(tool.id);
              const pct = limit === -1 ? 0 : limit === 0 ? 100 : Math.min((used / limit) * 100, 100);
              return (
                <div key={tool.id}>
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <div className="text-white font-medium text-sm">{tool.display_name}</div>
                      <div className="text-xs text-slate-500">{tool.description}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-white font-semibold">{used.toLocaleString()}</div>
                      <div className="text-xs text-slate-500">
                        of {limit === -1 ? 'Unlimited' : limit === 0 ? 'Not included' : limit.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                      }`}
                      style={{ width: limit === -1 ? '10%' : `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-2xl p-6 flex items-start gap-4">
          <TrendingUp className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-white font-semibold mb-1">Need more tokens?</h3>
            <p className="text-slate-400 text-sm">
              Upgrade your plan anytime to unlock higher limits and access premium models.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-white">{value}</div>
    </div>
  );
}
