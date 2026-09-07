import React, { useState, useEffect } from 'react';
import { Award, ShieldCheck, Save, Loader2, RefreshCw, AlertCircle, CheckCircle2, Clock, DollarSign, Percent, Zap } from 'lucide-react';

interface RewardsPolicySettingsProps {
  adminToken?: string;
}

export const RewardsPolicySettings: React.FC<RewardsPolicySettingsProps> = ({ adminToken }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Policy Form State
  const [enabled, setEnabled] = useState<boolean>(true);
  const [pointsPerRupees, setPointsPerRupees] = useState<number>(100);
  const [pointsPendingDaysAfterDelivery, setPointsPendingDaysAfterDelivery] = useState<number>(7);
  const [pointsExpiryMonths, setPointsExpiryMonths] = useState<number>(12);
  const [minimumEligibleSpend, setMinimumEligibleSpend] = useState<number>(0);
  const [maximumPointsPerOrder, setMaximumPointsPerOrder] = useState<number | null>(null);
  const [enableMaxPointsCap, setEnableMaxPointsCap] = useState<boolean>(false);
  const [minimumRedemptionPoints, setMinimumRedemptionPoints] = useState<number>(100);
  const [maximumRedemptionPercent, setMaximumRedemptionPercent] = useState<number>(20);

  // Tiers
  const [memberMultiplier, setMemberMultiplier] = useState<number>(1.0);
  const [silverMultiplier, setSilverMultiplier] = useState<number>(1.25);
  const [silverThreshold, setSilverThreshold] = useState<number>(15000);
  const [goldMultiplier, setGoldMultiplier] = useState<number>(1.5);
  const [goldThreshold, setGoldThreshold] = useState<number>(40000);
  const [platinumMultiplier, setPlatinumMultiplier] = useState<number>(2.0);
  const [platinumThreshold, setPlatinumThreshold] = useState<number>(80000);

  useEffect(() => {
    fetchPolicy();
  }, []);

  const fetchPolicy = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/loyalty/policy', {
        headers: {
          'Authorization': `Bearer ${adminToken || ''}`
        }
      });
      const data = await res.json();
      if (data.success && data.policy) {
        const p = data.policy;
        setEnabled(p.enabled !== false);
        setPointsPerRupees(p.pointsPerRupees || 100);
        setPointsPendingDaysAfterDelivery(p.pointsPendingDaysAfterDelivery ?? 7);
        setPointsExpiryMonths(p.pointsExpiryMonths || 12);
        setMinimumEligibleSpend(p.minimumEligibleSpend || 0);
        if (p.maximumPointsPerOrder) {
          setMaximumPointsPerOrder(p.maximumPointsPerOrder);
          setEnableMaxPointsCap(true);
        } else {
          setMaximumPointsPerOrder(null);
          setEnableMaxPointsCap(false);
        }
        setMinimumRedemptionPoints(p.minimumRedemptionPoints || 100);
        setMaximumRedemptionPercent(p.maximumRedemptionPercent || 20);

        // Map tiers
        if (Array.isArray(p.tiers)) {
          const m = p.tiers.find((t: any) => t.tier === 'MEMBER');
          if (m) setMemberMultiplier(m.earning_multiplier || 1.0);

          const s = p.tiers.find((t: any) => t.tier === 'SILVER');
          if (s) {
            setSilverMultiplier(s.earning_multiplier || 1.25);
            setSilverThreshold(s.min_spend_rupees || 15000);
          }

          const g = p.tiers.find((t: any) => t.tier === 'GOLD');
          if (g) {
            setGoldMultiplier(g.earning_multiplier || 1.5);
            setGoldThreshold(g.min_spend_rupees || 40000);
          }

          const pt = p.tiers.find((t: any) => t.tier === 'PLATINUM');
          if (pt) {
            setPlatinumMultiplier(pt.earning_multiplier || 2.0);
            setPlatinumThreshold(pt.min_spend_rupees || 80000);
          }
        }
      }
    } catch (err: any) {
      setError('Failed to load current Sa and Sha Rewards settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const payload = {
      enabled,
      pointsPerRupees: Number(pointsPerRupees),
      pointsPendingDaysAfterDelivery: Number(pointsPendingDaysAfterDelivery),
      pointsExpiryMonths: Number(pointsExpiryMonths),
      minimumEligibleSpend: Number(minimumEligibleSpend),
      maximumPointsPerOrder: enableMaxPointsCap && maximumPointsPerOrder ? Number(maximumPointsPerOrder) : null,
      minimumRedemptionPoints: Number(minimumRedemptionPoints),
      maximumRedemptionPercent: Number(maximumRedemptionPercent),
      tiers: [
        {
          tier: "MEMBER",
          min_spend_rupees: 0,
          max_spend_rupees: silverThreshold - 1,
          earning_multiplier: Number(memberMultiplier)
        },
        {
          tier: "SILVER",
          min_spend_rupees: Number(silverThreshold),
          max_spend_rupees: goldThreshold - 1,
          earning_multiplier: Number(silverMultiplier)
        },
        {
          tier: "GOLD",
          min_spend_rupees: Number(goldThreshold),
          max_spend_rupees: platinumThreshold - 1,
          earning_multiplier: Number(goldMultiplier)
        },
        {
          tier: "PLATINUM",
          min_spend_rupees: Number(platinumThreshold),
          max_spend_rupees: null,
          earning_multiplier: Number(platinumMultiplier)
        }
      ]
    };

    try {
      const res = await fetch('/api/admin/loyalty/policy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken || ''}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to save Sa and Sha Rewards policy.');
      } else {
        setSuccessMsg('Sa and Sha Rewards Master Policy updated successfully and audit logged!');
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    } catch (err: any) {
      setError('Connection error while saving policy.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-stone-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Loading Sa and Sha Rewards Policy Settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-amber-50/50 p-6 rounded-2xl border border-amber-200/60">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-100 rounded-xl text-amber-900">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold text-stone-900">Sa and Sha Rewards Policy & Master Settings</h2>
            <p className="text-xs text-stone-600 mt-0.5">
              Configure points earning rates, 7-day return window holding period, tier thresholds, and redemption caps.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-stone-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-800"></div>
            <span className="ml-2 text-xs font-bold text-stone-800">
              {enabled ? 'Earning Active' : 'Earning Paused'}
            </span>
          </label>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Core Earning Parameters */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-4 shadow-2xs">
          <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-3">
            <Zap className="w-4 h-4 text-amber-700" />
            <span>Base Earning Engine & Holding Window</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
            <div>
              <label className="block font-medium text-stone-700 mb-1">Rupees per 1 Base Point</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-stone-400 font-bold">₹</span>
                <input
                  type="number"
                  min="1"
                  value={pointsPerRupees}
                  onChange={(e) => setPointsPerRupees(Number(e.target.value))}
                  className="w-full pl-8 pr-3 py-2 border border-stone-300 rounded-xl focus:ring-1 focus:ring-amber-800 focus:border-amber-800"
                  required
                />
              </div>
              <p className="text-[10px] text-stone-500 mt-1">₹100 spend = 1 base point</p>
            </div>

            <div>
              <label className="block font-medium text-stone-700 mb-1">Return Window Hold (Days)</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={pointsPendingDaysAfterDelivery}
                  onChange={(e) => setPointsPendingDaysAfterDelivery(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-1 focus:ring-amber-800 focus:border-amber-800"
                  required
                />
              </div>
              <p className="text-[10px] text-stone-500 mt-1">Points stay PENDING for 7 days post-delivery</p>
            </div>

            <div>
              <label className="block font-medium text-stone-700 mb-1">Points Expiry Period (Months)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={pointsExpiryMonths}
                onChange={(e) => setPointsExpiryMonths(Number(e.target.value))}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-1 focus:ring-amber-800 focus:border-amber-800"
                required
              />
              <p className="text-[10px] text-stone-500 mt-1">Months before active points expire</p>
            </div>

            <div>
              <label className="block font-medium text-stone-700 mb-1">Minimum Eligible Order Spend</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-stone-400 font-bold">₹</span>
                <input
                  type="number"
                  min="0"
                  value={minimumEligibleSpend}
                  onChange={(e) => setMinimumEligibleSpend(Number(e.target.value))}
                  className="w-full pl-8 pr-3 py-2 border border-stone-300 rounded-xl focus:ring-1 focus:ring-amber-800 focus:border-amber-800"
                />
              </div>
              <p className="text-[10px] text-stone-500 mt-1">Minimum net order spend required to earn</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-medium text-stone-700">Max Points Cap / Order</label>
                <input
                  type="checkbox"
                  checked={enableMaxPointsCap}
                  onChange={(e) => setEnableMaxPointsCap(e.target.checked)}
                  className="rounded border-stone-300 text-amber-800 focus:ring-amber-800"
                />
              </div>
              <input
                type="number"
                min="1"
                disabled={!enableMaxPointsCap}
                value={maximumPointsPerOrder || ''}
                onChange={(e) => setMaximumPointsPerOrder(e.target.value ? Number(e.target.value) : null)}
                placeholder="No cap if unchecked"
                className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-1 focus:ring-amber-800 focus:border-amber-800 disabled:bg-stone-100 disabled:text-stone-400"
              />
              <p className="text-[10px] text-stone-500 mt-1">Optional ceiling on earned points per order</p>
            </div>

            <div>
              <label className="block font-medium text-stone-700 mb-1">Max Order Redemption Cap (%)</label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={maximumRedemptionPercent}
                  onChange={(e) => setMaximumRedemptionPercent(Number(e.target.value))}
                  className="w-full pr-8 pl-3 py-2 border border-stone-300 rounded-xl focus:ring-1 focus:ring-amber-800 focus:border-amber-800"
                  required
                />
                <span className="absolute right-3 top-2.5 text-stone-400 font-bold">%</span>
              </div>
              <p className="text-[10px] text-stone-500 mt-1">Max percentage of subtotal payable with points</p>
            </div>
          </div>
        </div>

        {/* Tier Multipliers & Thresholds */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-4 shadow-2xs">
          <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-3">
            <Award className="w-4 h-4 text-amber-700" />
            <span>Customer Tier Thresholds & Earning Multipliers</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* MEMBER */}
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
              <span className="inline-block px-2.5 py-0.5 bg-stone-200 text-stone-800 font-bold text-[10px] rounded-full">
                MEMBER
              </span>
              <div>
                <label className="block text-[11px] font-medium text-stone-600 mb-0.5">Earning Multiplier</label>
                <input
                  type="number"
                  step="0.05"
                  min="1.0"
                  value={memberMultiplier}
                  onChange={(e) => setMemberMultiplier(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-semibold bg-white"
                />
              </div>
              <p className="text-[10px] text-stone-500">Spend: ₹0 – ₹{silverThreshold - 1}</p>
            </div>

            {/* SILVER */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <span className="inline-block px-2.5 py-0.5 bg-slate-200 text-slate-800 font-bold text-[10px] rounded-full">
                SILVER
              </span>
              <div>
                <label className="block text-[11px] font-medium text-stone-600 mb-0.5">Spend Threshold (₹)</label>
                <input
                  type="number"
                  value={silverThreshold}
                  onChange={(e) => setSilverThreshold(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-semibold bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-600 mb-0.5">Earning Multiplier</label>
                <input
                  type="number"
                  step="0.05"
                  min="1.0"
                  value={silverMultiplier}
                  onChange={(e) => setSilverMultiplier(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-semibold bg-white"
                />
              </div>
            </div>

            {/* GOLD */}
            <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200/80 space-y-3">
              <span className="inline-block px-2.5 py-0.5 bg-amber-200 text-amber-900 font-bold text-[10px] rounded-full">
                GOLD
              </span>
              <div>
                <label className="block text-[11px] font-medium text-stone-600 mb-0.5">Spend Threshold (₹)</label>
                <input
                  type="number"
                  value={goldThreshold}
                  onChange={(e) => setGoldThreshold(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-semibold bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-600 mb-0.5">Earning Multiplier</label>
                <input
                  type="number"
                  step="0.05"
                  min="1.0"
                  value={goldMultiplier}
                  onChange={(e) => setGoldMultiplier(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-semibold bg-white"
                />
              </div>
            </div>

            {/* PLATINUM */}
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-200 space-y-3">
              <span className="inline-block px-2.5 py-0.5 bg-purple-200 text-purple-900 font-bold text-[10px] rounded-full">
                PLATINUM
              </span>
              <div>
                <label className="block text-[11px] font-medium text-stone-600 mb-0.5">Spend Threshold (₹)</label>
                <input
                  type="number"
                  value={platinumThreshold}
                  onChange={(e) => setPlatinumThreshold(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-semibold bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-600 mb-0.5">Earning Multiplier</label>
                <input
                  type="number"
                  step="0.05"
                  min="1.0"
                  value={platinumMultiplier}
                  onChange={(e) => setPlatinumMultiplier(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-semibold bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={fetchPolicy}
            className="px-4 py-2 border border-stone-300 text-stone-700 text-xs font-medium rounded-xl hover:bg-stone-50 transition-colors inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Form</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-stone-900 text-white text-xs font-bold rounded-xl hover:bg-stone-800 transition-colors inline-flex items-center gap-2 shadow-md disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Sa and Sha Rewards Policy...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Sa and Sha Rewards Policy</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
