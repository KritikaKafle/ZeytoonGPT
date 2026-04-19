import { useEffect, useState } from 'react';
import { Check, Crown, Zap, Rocket, Menu } from 'lucide-react';
import { supabase, SubscriptionPlan, PlanToolLimit, AITool } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type Props = { onOpenSidebar: () => void };

export default function BillingPage({ onOpenSidebar }: Props) {
  const { profile, refreshProfile } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [limits, setLimits] = useState<PlanToolLimit[]>([]);
  const [tools, setTools] = useState<AITool[]>([]);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [plansRes, limitsRes, toolsRes] = await Promise.all([
        supabase.from('subscription_plans').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('plan_tool_limits').select('*'),
        supabase.from('ai_tools').select('*').eq('is_active', true),
      ]);
      setPlans(plansRes.data || []);
      setLimits(limitsRes.data || []);
      setTools(toolsRes.data || []);
    })();
  }, []);

  const handleUpgrade = async (planId: string) => {
    if (!profile) return;
    setUpgrading(planId);
    await supabase
      .from('profiles')
      .update({
        subscription_plan_id: planId,
        subscription_status: 'active',
        subscription_started_at: new Date().toISOString(),
        subscription_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', profile.id);
    await refreshProfile();
    setUpgrading(null);
  };

  const planIcons = [Zap, Crown, Rocket];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-900">
      <header className="border-b border-slate-800 px-4 py-3 flex items-center gap-3 sticky top-0 bg-slate-900 z-10">
        <button onClick={onOpenSidebar} className="md:hidden text-slate-400 hover:text-white">
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold text-white">Subscription Plans</h1>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Choose the plan that fits your workflow
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Scale AI capabilities to your needs. Upgrade or downgrade anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, idx) => {
            const Icon = planIcons[idx] || Zap;
            const isActive = profile?.subscription_plan_id === plan.id;
            const isPro = plan.name === 'Pro';
            return (
              <div
                key={plan.id}
                className={`relative bg-slate-800/60 backdrop-blur border rounded-3xl p-8 transition ${
                  isPro ? 'border-emerald-500/50 shadow-xl shadow-emerald-500/10 md:scale-105' : 'border-slate-700/60'
                }`}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    MOST POPULAR
                  </div>
                )}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                  isPro ? 'bg-gradient-to-br from-emerald-400 to-teal-600' : 'bg-slate-700'
                }`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-sm text-slate-400 mb-4">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">${plan.price_monthly}</span>
                  <span className="text-slate-400">/month</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-slate-700/60 pt-4 mb-6 space-y-1.5">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Token Limits</div>
                  {tools.map(tool => {
                    const limit = limits.find(l => l.plan_id === plan.id && l.tool_id === tool.id);
                    const val = limit?.monthly_token_limit ?? 0;
                    return (
                      <div key={tool.id} className="flex justify-between text-xs">
                        <span className="text-slate-400">{tool.display_name}</span>
                        <span className="text-slate-300 font-medium">
                          {val === -1 ? 'Unlimited' : val === 0 ? 'Not included' : `${val.toLocaleString()} / mo`}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isActive || upgrading === plan.id}
                  className={`w-full rounded-xl py-3 font-medium transition ${
                    isActive
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      : isPro
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                >
                  {isActive ? 'Current Plan' : upgrading === plan.id ? 'Processing...' : `Switch to ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
