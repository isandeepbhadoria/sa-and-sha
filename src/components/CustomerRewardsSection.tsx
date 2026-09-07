import React, { useState, useEffect } from 'react';
import { Award, CreditCard, Sparkles, TrendingUp, Clock, ChevronRight, Gift, ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react';

interface Props {
  verificationToken: string;
  customerPhone?: string;
}

export const CustomerRewardsSection: React.FC<Props> = ({ verificationToken, customerPhone }) => {
  const [rewardsData, setRewardsData] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity'>('overview');

  const fetchRewardsData = async () => {
    if (!verificationToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/customer/rewards', {
        headers: {
          'x-mobile-verification-token': verificationToken
        }
      });
      const data = await res.json();
      if (data.success) {
        setRewardsData(data);
      } else {
        setError(data.error || 'Failed to load rewards account.');
      }
    } catch (err) {
      setError('Network error loading rewards.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActivity = async () => {
    if (!verificationToken) return;
    try {
      const res = await fetch('/api/customer/rewards/activity?limit=20', {
        headers: {
          'x-mobile-verification-token': verificationToken
        }
      });
      const data = await res.json();
      if (data.success) {
        setActivity(data.activity || []);
      }
    } catch (err) {
      console.warn('Failed to fetch activity');
    }
  };

  useEffect(() => {
    fetchRewardsData();
    fetchActivity();
  }, [verificationToken]);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-stone-500 flex flex-col items-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-stone-400" />
        <span className="text-xs tracking-wider uppercase">Loading Kora Rewards...</span>
      </div>
    );
  }

  if (error || !rewardsData) {
    return (
      <div className="p-6 bg-stone-50 border border-stone-200 rounded-lg text-center">
        <AlertCircle className="w-6 h-6 text-stone-400 mx-auto mb-2" />
        <p className="text-xs text-stone-600 mb-3">{error || 'Please verify OTP to access your rewards.'}</p>
        <button
          onClick={fetchRewardsData}
          className="text-xs font-semibold px-4 py-2 bg-stone-900 text-white rounded hover:bg-stone-800 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { loyalty_summary, store_credit_summary, tier_info } = rewardsData;
  const availablePoints = loyalty_summary?.available_points || 0;
  const pendingPoints = loyalty_summary?.pending_points || 0;
  const creditRupees = store_credit_summary?.available_balance_rupees || 0;
  const currentTier = loyalty_summary?.current_tier || 'MEMBER';
  const progress = loyalty_summary?.tier_progress;

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header Banner */}
      <div className="bg-stone-900 text-white p-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium tracking-widest uppercase text-stone-300">Sa and Sha Rewards</span>
            </div>
            <h3 className="text-2xl font-serif tracking-tight text-stone-100 flex items-center gap-2">
              <span>{currentTier} Member</span>
              <span className="text-xs font-sans font-normal px-2.5 py-0.5 rounded-full bg-stone-800 border border-stone-700 text-stone-300">
                {tier_info?.earning_multiplier}x Earn Multiplier
              </span>
            </h3>
          </div>
          <div className="flex items-center gap-3 bg-stone-800/80 backdrop-blur border border-stone-700 p-3 rounded-lg">
            <CreditCard className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="text-[10px] tracking-wider uppercase text-stone-400">Store Credit Balance</div>
              <div className="text-lg font-bold font-mono text-stone-100">₹{creditRupees.toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>

        {/* Tier Progress Bar */}
        {progress?.next_tier && (
          <div className="mt-6 pt-4 border-t border-stone-800">
            <div className="flex justify-between text-xs text-stone-300 mb-1 font-medium">
              <span>Current Tier: {currentTier}</span>
              <span>Next Tier: {progress.next_tier} (₹{progress.spend_required_for_next_tier_rupees?.toLocaleString('en-IN')} more needed)</span>
            </div>
            <div className="w-full bg-stone-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-amber-300 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(5, ((progress.rolling_12m_spend_rupees || 0) / ((progress.rolling_12m_spend_rupees || 0) + (progress.spend_required_for_next_tier_rupees || 1))) * 100))}%`
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Point Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-stone-100 border-b border-stone-100 bg-stone-50/50">
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-1.5 text-xs text-stone-500 mb-1">
            <Award className="w-3.5 h-3.5 text-stone-700" />
            <span>Available Points</span>
          </div>
          <div className="text-2xl font-bold font-mono text-stone-900">{availablePoints}</div>
          <div className="text-[10px] text-stone-500 mt-0.5">Worth ₹{availablePoints} on next order</div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-1.5 text-xs text-stone-500 mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Pending Points</span>
          </div>
          <div className="text-2xl font-bold font-mono text-stone-900">{pendingPoints}</div>
          <div className="text-[10px] text-stone-500 mt-0.5">Unlocks 14 days post-delivery</div>
        </div>

        <div className="p-4 sm:p-5 col-span-2 sm:col-span-1 border-t sm:border-t-0 border-stone-100">
          <div className="flex items-center gap-1.5 text-xs text-stone-500 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-stone-700" />
            <span>Lifetime Earned</span>
          </div>
          <div className="text-2xl font-bold font-mono text-stone-900">{loyalty_summary?.lifetime_points_earned || 0}</div>
          <div className="text-[10px] text-stone-500 mt-0.5">Points earned to date</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200 bg-stone-50">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-5 py-3 text-xs font-medium uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === 'overview'
              ? 'border-stone-900 text-stone-900 bg-white font-semibold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          VIP Benefits
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`px-5 py-3 text-xs font-medium uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === 'activity'
              ? 'border-stone-900 text-stone-900 bg-white font-semibold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Activity Log ({activity.length})
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-5">
        {activeTab === 'overview' ? (
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-stone-800" />
              <span>Your VIP Membership Privileges</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-lg flex items-start gap-3">
                <Gift className="w-5 h-5 text-stone-800 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-stone-900">{tier_info?.earning_multiplier}x Rewards Accumulation</div>
                  <div className="text-[11px] text-stone-500 mt-0.5">Earn points faster on every European linen garment purchase.</div>
                </div>
              </div>

              <div className={`p-3.5 border rounded-lg flex items-start gap-3 ${tier_info?.benefits?.free_standard_shipping ? 'bg-amber-50/50 border-amber-200' : 'bg-stone-50/50 border-stone-200 opacity-60'}`}>
                <ShieldCheck className="w-5 h-5 text-stone-800 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-stone-900">Complimentary Shipping</div>
                  <div className="text-[11px] text-stone-500 mt-0.5">
                    {tier_info?.benefits?.free_standard_shipping ? 'Unlocked for Gold & Platinum members.' : 'Reach Gold tier (₹40,000 spend) to unlock.'}
                  </div>
                </div>
              </div>

              <div className={`p-3.5 border rounded-lg flex items-start gap-3 ${tier_info?.benefits?.early_access ? 'bg-amber-50/50 border-amber-200' : 'bg-stone-50/50 border-stone-200 opacity-60'}`}>
                <Sparkles className="w-5 h-5 text-stone-800 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-stone-900">Early Access to New Collections</div>
                  <div className="text-[11px] text-stone-500 mt-0.5">
                    {tier_info?.benefits?.early_access ? 'Active privilege for Silver, Gold & Platinum.' : 'Reach Silver tier (₹15,000 spend) to unlock.'}
                  </div>
                </div>
              </div>

              <div className={`p-3.5 border rounded-lg flex items-start gap-3 ${tier_info?.benefits?.priority_support ? 'bg-amber-50/50 border-amber-200' : 'bg-stone-50/50 border-stone-200 opacity-60'}`}>
                <Award className="w-5 h-5 text-stone-800 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-stone-900">Platinum Priority Support</div>
                  <div className="text-[11px] text-stone-500 mt-0.5">
                    {tier_info?.benefits?.priority_support ? 'Dedicated concierge assistance.' : 'Exclusive to Platinum tier.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {activity.length === 0 ? (
              <p className="text-xs text-stone-500 text-center py-6">No recent rewards activity recorded yet.</p>
            ) : (
              <div className="divide-y divide-stone-100">
                {activity.map((item, idx) => (
                  <div key={item.id || idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-stone-800">{item.description}</div>
                      <div className="text-[10px] text-stone-400">
                        {item.type === 'points' ? 'Loyalty Points' : 'Store Credit'} • {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                      </div>
                    </div>
                    <div className={`font-mono font-bold ${item.amount > 0 ? 'text-emerald-700' : 'text-stone-700'}`}>
                      {item.type === 'points' ? (
                        `${item.amount > 0 ? '+' : ''}${item.amount} pts`
                      ) : (
                        `${item.amount > 0 ? '+' : ''}₹${Math.abs(item.amount)}`
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
