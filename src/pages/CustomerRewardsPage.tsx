import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Sparkles, Award, CreditCard, Clock, ShieldCheck, Crown, Gift, 
  TrendingUp, CheckCircle2, AlertCircle, ChevronRight, RefreshCw, 
  ArrowUpRight, Zap, ShoppingBag, PackageCheck, UserCheck, Cake, 
  Share2, ArrowLeft, Wallet, Calendar, AlertTriangle, Calculator
} from "lucide-react";
import { RewardsDashboardResponse } from "../server/customerRewardsHelpers";

export const CustomerRewardsPage: React.FC = () => {
  const [dashboard, setDashboard] = useState<RewardsDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active tab state for activity section
  const [activityTab, setActivityTab] = useState<"rewards" | "wallet">("rewards");

  // Interactive Redemption Simulator State
  const [simCartAmount, setSimCartAmount] = useState<number>(4800);
  const [simPointsToRedeem, setSimPointsToRedeem] = useState<number>(0);

  const fetchDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/rewards/dashboard");
      const data = await res.json();
      if (res.ok && data.success) {
        setDashboard(data);
        if (data.loyalty_summary?.available_points) {
          setSimPointsToRedeem(data.loyalty_summary.available_points);
        }
      } else {
        setError(data.error || "Please verify your account via OTP to access your Membership Center.");
      }
    } catch (err) {
      setError("Network error connecting to Sa and Sha Membership Center.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex flex-col items-center justify-center min-h-[400px]">
          <RefreshCw className="w-8 h-8 text-amber-700 animate-spin mb-4" />
          <p className="text-sm font-medium tracking-widest text-stone-600 uppercase">
            Loading Sa and Sha Membership Center...
          </p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-stone-50 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl mx-auto bg-white border border-stone-200 rounded-2xl p-8 shadow-sm text-center">
          <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <Crown className="w-6 h-6 text-amber-800" />
          </div>
          <h2 className="text-xl font-serif text-stone-900 mb-2">Sa and Sha Membership Center</h2>
          <p className="text-xs text-stone-600 mb-6 leading-relaxed">
            {error || "Authentication required to access your rewards, store credit wallet, and VIP privileges."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/account"
              className="px-5 py-2.5 bg-stone-900 text-white text-xs font-semibold rounded-lg hover:bg-stone-800 transition-colors"
            >
              Go to Account Dashboard
            </Link>
            <button
              onClick={fetchDashboard}
              className="px-5 py-2.5 bg-stone-100 text-stone-800 text-xs font-semibold rounded-lg hover:bg-stone-200 transition-colors border border-stone-200"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { 
    profile, 
    tier, 
    tier_progress, 
    loyalty_summary, 
    store_credit_summary, 
    reward_timeline, 
    wallet_timeline, 
    expiring_points, 
    membership_journey, 
    achievements, 
    recommendations 
  } = dashboard;

  // Simulator Calculation Logic
  const availablePoints = loyalty_summary.available_points || 0;
  const maxDiscountAllowed = Math.floor(simCartAmount * 0.20); // 20% cap
  const maxPointsAllowedByCap = maxDiscountAllowed; // 1 pt = ₹1
  const maxRedeemablePoints = Math.min(availablePoints, maxPointsAllowedByCap);
  
  const effectivePointsRedeemed = Math.min(simPointsToRedeem, maxRedeemablePoints);
  const discountRupees = Math.min(effectivePointsRedeemed, maxDiscountAllowed);
  const remainingPoints = Math.max(0, availablePoints - effectivePointsRedeemed);
  const remainingPayable = Math.max(0, simCartAmount - discountRupees);

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-900 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link 
            to="/account" 
            className="inline-flex items-center gap-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <span className="text-xs text-stone-500 font-mono">
            Customer ID: {dashboard.businessCustomerId}
          </span>
        </div>

        {/* SECTION 2: MEMBERSHIP HERO */}
        <div className="relative bg-stone-950 text-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl overflow-hidden border border-stone-800">
          {/* Subtle Luxury Pattern Background */}
          <div className="absolute inset-0 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:24px_24px] opacity-10" />
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold tracking-widest uppercase">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Sa and Sha Atelier Privileges</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-light tracking-tight text-amber-50">
                Hello, {profile.first_name} 👋
              </h1>
              <p className="text-xs sm:text-sm text-stone-400 max-w-xl leading-relaxed">
                Welcome to your bespoke membership dashboard. Track loyalty points, store credit wallet balances, exclusive tier privileges, and progress toward higher VIP ranks.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-stone-300 pt-2 font-mono">
                <div>
                  <span className="text-stone-500 uppercase tracking-wider block text-[10px]">Member Since</span>
                  <span className="font-semibold text-stone-200">
                    {new Date(profile.member_since).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                  </span>
                </div>
                <div className="h-6 w-px bg-stone-800 hidden sm:block" />
                <div>
                  <span className="text-stone-500 uppercase tracking-wider block text-[10px]">Rolling 12-Month Spend</span>
                  <span className="font-semibold text-stone-200">
                    ₹{tier_progress.rolling_12m_spend_rupees.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            {/* Current Tier Badge Card */}
            <div className="bg-stone-900/90 border border-amber-500/30 p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 min-w-[260px] backdrop-blur-md">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-stone-950 shadow-lg border border-amber-300">
                <Crown className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] tracking-widest text-amber-400 uppercase font-semibold block mb-0.5">
                  Current Status
                </span>
                <h3 className="text-2xl font-serif text-stone-100 font-medium">
                  {tier.tier_label}
                </h3>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                {tier.earning_multiplier}x Earning Multiplier
              </span>
            </div>
          </div>

          {/* SECTION 4: TIER PROGRESS BAR */}
          {tier_progress.next_tier && (
            <div className="relative z-10 mt-8 pt-6 border-t border-stone-800/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                <span className="text-stone-300 font-medium flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  <span>Tier Progress: {tier_progress.progress_percent}% to {tier_progress.next_tier}</span>
                </span>
                <span className="text-amber-300 font-mono font-semibold">
                  ₹{tier_progress.spend_required_for_next_tier_rupees.toLocaleString("en-IN")} needed for {tier_progress.next_tier}
                </span>
              </div>
              <div className="w-full bg-stone-900 h-3 rounded-full overflow-hidden p-0.5 border border-stone-800">
                <div 
                  className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 h-full rounded-full transition-all duration-700 shadow-sm"
                  style={{ width: `${Math.max(5, tier_progress.progress_percent)}%` }}
                />
              </div>
              <p className="text-[11px] text-stone-400 italic">
                {tier_progress.unlocks_summary}
              </p>
            </div>
          )}
        </div>

        {/* SECTION 9: EXPIRING POINTS ALERT (IF APPLICABLE) */}
        {expiring_points.has_expiring && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-sm">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Expiring Points Alert
              </h4>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                You have <strong className="font-mono text-amber-950 font-bold">{expiring_points.expiring_points} points</strong> expiring in{" "}
                <strong className="font-bold text-amber-950">{expiring_points.days_remaining} days</strong>{" "}
                ({expiring_points.expiry_date ? new Date(expiring_points.expiry_date).toLocaleDateString("en-IN") : "Soon"}). Redeem them on your next order!
              </p>
            </div>
          </div>
        )}

        {/* SECTION 5 & 6: REWARDS SUMMARY & STORE CREDIT WALLET */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* SECTION 5: REWARDS SUMMARY CARD */}
          <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-stone-100 rounded-xl text-stone-900">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-serif text-stone-900">Kora Rewards Summary</h2>
                  <p className="text-[11px] text-stone-500">1 Point = ₹1 Discount on Checkout</p>
                </div>
              </div>
              <span className="text-xs font-bold font-mono px-3 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-full">
                ₹{loyalty_summary.current_redemption_value_rupees.toLocaleString("en-IN")} Value
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                <span className="text-[10px] uppercase font-semibold text-stone-500 tracking-wider block mb-1">
                  Available Points
                </span>
                <span className="text-3xl font-bold font-mono text-stone-900">
                  {loyalty_summary.available_points}
                </span>
                <p className="text-[10px] text-stone-500 mt-1">Ready to redeem</p>
              </div>

              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                <span className="text-[10px] uppercase font-semibold text-stone-500 tracking-wider block mb-1">
                  Pending Points
                </span>
                <span className="text-3xl font-bold font-mono text-amber-700">
                  {loyalty_summary.pending_points}
                </span>
                <p className="text-[10px] text-stone-500 mt-1">Unlocks 14d post-delivery</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 text-center divide-x divide-stone-100 bg-stone-50/50 p-3 rounded-2xl border border-stone-100">
              <div>
                <span className="text-[9px] uppercase font-semibold text-stone-500 block">Lifetime Earned</span>
                <span className="text-xs font-bold font-mono text-stone-800">{loyalty_summary.lifetime_points_earned}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-semibold text-stone-500 block">Redeemed</span>
                <span className="text-xs font-bold font-mono text-stone-800">{loyalty_summary.lifetime_points_redeemed}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-semibold text-stone-500 block">Expired</span>
                <span className="text-xs font-bold font-mono text-stone-500">{loyalty_summary.lifetime_points_expired}</span>
              </div>
            </div>
          </div>

          {/* SECTION 6: STORE CREDIT WALLET CARD */}
          <div className="bg-stone-900 text-white border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 relative overflow-hidden">
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-stone-800 rounded-xl text-amber-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-serif text-stone-100">Store Credit Wallet</h2>
                  <p className="text-[11px] text-stone-400">Instant checkout balance & refunds</p>
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 bg-stone-800 text-stone-300 rounded-full border border-stone-700">
                100% Auto-Applied
              </span>
            </div>

            <div className="p-5 bg-stone-800/80 border border-stone-700 rounded-2xl space-y-2">
              <span className="text-[10px] uppercase tracking-widest text-stone-400 block font-semibold">
                Available Wallet Balance
              </span>
              <div className="text-4xl font-serif font-bold text-amber-300 font-mono">
                ₹{store_credit_summary.available_balance_rupees.toLocaleString("en-IN")}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-stone-800/50 rounded-xl border border-stone-800">
                <span className="text-[10px] text-stone-400 uppercase block font-medium">Refund Credits</span>
                <span className="font-bold text-stone-200 font-mono">₹{store_credit_summary.refund_credits_rupees.toLocaleString("en-IN")}</span>
              </div>
              <div className="p-3 bg-stone-800/50 rounded-xl border border-stone-800">
                <span className="text-[10px] text-stone-400 uppercase block font-medium">Promotional Credits</span>
                <span className="font-bold text-amber-300 font-mono">₹{store_credit_summary.promotional_credits_rupees.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {store_credit_summary.last_credit_added && (
              <p className="text-[11px] text-stone-400 font-mono pt-1">
                Last added: ₹{store_credit_summary.last_credit_added.amount_rupees} ({store_credit_summary.last_credit_added.description})
              </p>
            )}
          </div>
        </div>

        {/* SECTION 3: TIER PRIVILEGES CARD */}
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-amber-800 block mb-1">
                Unlocked Privileges
              </span>
              <h2 className="text-2xl font-serif text-stone-900">Your {tier.tier_label} Benefits</h2>
            </div>
            <span className={`self-start sm:self-center px-3 py-1 text-xs font-bold rounded-full border ${tier.badge_color}`}>
              {tier.tier_label} Status Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tier.benefits.map((b) => (
              <div 
                key={b.key} 
                className={`p-4 rounded-2xl border transition-all ${
                  b.applicable 
                    ? "bg-amber-50/40 border-amber-200 shadow-2xs" 
                    : "bg-stone-50 border-stone-200 opacity-60"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {b.applicable ? (
                    <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-stone-400 shrink-0" />
                  )}
                  <h4 className="text-xs font-bold text-stone-900">{b.label}</h4>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">{b.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 10: REDEMPTION SIMULATOR */}
        <div className="bg-gradient-to-br from-amber-900 via-stone-900 to-stone-950 text-white rounded-3xl p-6 sm:p-8 shadow-md border border-amber-500/20 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-300">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-serif text-amber-100">Redemption Simulator</h3>
              <p className="text-xs text-stone-300">Test how much you save on your next Sa and Sha cart</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">
                  Cart Subtotal (₹)
                </label>
                <input 
                  type="number"
                  min="500"
                  step="500"
                  value={simCartAmount}
                  onChange={(e) => setSimCartAmount(Math.max(100, Number(e.target.value)))}
                  className="w-full px-4 py-3 bg-stone-800/90 border border-stone-700 rounded-xl text-white font-mono text-base focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">
                  Requested Points to Redeem (Max {availablePoints})
                </label>
                <input 
                  type="number"
                  min="0"
                  max={availablePoints}
                  value={simPointsToRedeem}
                  onChange={(e) => setSimPointsToRedeem(Math.max(0, Number(e.target.value)))}
                  className="w-full px-4 py-3 bg-stone-800/90 border border-stone-700 rounded-xl text-white font-mono text-base focus:outline-none focus:border-amber-400"
                />
              </div>

              <p className="text-[11px] text-stone-400 leading-relaxed">
                * Note: Minimum redemption is 100 points. Maximum redemption discount is capped at 20% of order subtotal (₹{maxDiscountAllowed.toLocaleString("en-IN")}).
              </p>
            </div>

            <div className="p-5 bg-stone-900/90 border border-stone-800 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-3 divide-y divide-stone-800 text-xs">
                <div className="flex justify-between pb-2">
                  <span className="text-stone-400">Original Cart Subtotal:</span>
                  <span className="font-mono font-bold text-stone-200">₹{simCartAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between pt-2 pb-2">
                  <span className="text-amber-300 font-semibold">Max Redeemable Discount:</span>
                  <span className="font-mono font-bold text-amber-300">- ₹{discountRupees.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between pt-2 pb-2">
                  <span className="text-stone-400">Remaining Loyalty Points:</span>
                  <span className="font-mono font-bold text-stone-300">{remainingPoints} pts</span>
                </div>
                <div className="flex justify-between pt-2 text-sm font-bold">
                  <span className="text-stone-100">Final Payable Amount:</span>
                  <span className="font-mono text-amber-200 text-lg">₹{remainingPayable.toLocaleString("en-IN")}</span>
                </div>
              </div>

              <Link 
                to="/shop" 
                className="w-full text-center py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold rounded-xl transition-colors uppercase tracking-wider"
              >
                Apply Points at Checkout →
              </Link>
            </div>
          </div>
        </div>

        {/* SECTION 7 & 8: REWARDS & WALLET ACTIVITY TIMELINE */}
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
            <div>
              <h2 className="text-xl font-serif text-stone-900">Activity History</h2>
              <p className="text-xs text-stone-500">Real-time ledger events for points & store credit</p>
            </div>

            <div className="flex bg-stone-100 p-1 rounded-xl">
              <button
                onClick={() => setActivityTab("rewards")}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  activityTab === "rewards" 
                    ? "bg-white text-stone-900 shadow-2xs" 
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                Points Ledger ({reward_timeline.length})
              </button>
              <button
                onClick={() => setActivityTab("wallet")}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  activityTab === "wallet" 
                    ? "bg-white text-stone-900 shadow-2xs" 
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                Wallet Ledger ({wallet_timeline.length})
              </button>
            </div>
          </div>

          {activityTab === "rewards" ? (
            reward_timeline.length === 0 ? (
              <p className="text-xs text-stone-500 text-center py-8">No rewards points activity recorded yet.</p>
            ) : (
              <div className="divide-y divide-stone-100">
                {reward_timeline.map((item) => (
                  <div key={item.id} className="py-3.5 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="font-semibold text-stone-900">{item.title}</div>
                      <div className="text-[10px] text-stone-500 font-mono mt-0.5">
                        {new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} • {item.description}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`font-mono font-bold text-sm ${item.points >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {item.points >= 0 ? `+${item.points}` : item.points} pts
                      </span>
                      <span className="block text-[9px] uppercase tracking-wider text-stone-400 font-medium">
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            wallet_timeline.length === 0 ? (
              <p className="text-xs text-stone-500 text-center py-8">No store credit wallet activity recorded yet.</p>
            ) : (
              <div className="divide-y divide-stone-100">
                {wallet_timeline.map((item) => (
                  <div key={item.id} className="py-3.5 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="font-semibold text-stone-900">{item.title}</div>
                      <div className="text-[10px] text-stone-500 font-mono mt-0.5">
                        {new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} • {item.description}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`font-mono font-bold text-sm ${item.amount_rupees >= 0 ? "text-emerald-700" : "text-stone-800"}`}>
                        {item.amount_rupees >= 0 ? `+₹${item.amount_rupees}` : `-₹${Math.abs(item.amount_rupees)}`}
                      </span>
                      <span className="block text-[9px] uppercase tracking-wider text-stone-400 font-medium">
                        {item.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* SECTION 11: MEMBERSHIP JOURNEY TIMELINE */}
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-800 block mb-1">
              Your Milestones
            </span>
            <h2 className="text-2xl font-serif text-stone-900">Membership Journey</h2>
          </div>

          <div className="relative pl-6 sm:pl-8 border-l-2 border-stone-200 space-y-8">
            {membership_journey.map((step, idx) => (
              <div key={step.id || idx} className="relative group">
                <div 
                  className={`absolute -left-[31px] sm:-left-[39px] top-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                    step.status === "completed" 
                      ? "bg-amber-500 border-amber-600 text-stone-950" 
                      : "bg-white border-stone-300 text-stone-400"
                  }`}
                >
                  {step.status === "completed" ? "✓" : idx + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-stone-900">{step.title}</h4>
                    {step.date && (
                      <span className="text-[10px] font-mono text-stone-400">
                        ({new Date(step.date).toLocaleDateString("en-IN")})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-600 mt-0.5">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 12: ACHIEVEMENTS BADGES */}
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-800 block mb-1">
              Badges & Milestones
            </span>
            <h2 className="text-2xl font-serif text-stone-900">Achievements</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {achievements.map((ach) => (
              <div 
                key={ach.id} 
                className={`p-4 rounded-2xl border text-center space-y-2 flex flex-col items-center justify-between ${
                  ach.unlocked 
                    ? "bg-amber-50/50 border-amber-300 shadow-2xs" 
                    : "bg-stone-50 border-stone-200 opacity-60"
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  ach.unlocked ? "bg-amber-500 text-stone-950" : "bg-stone-200 text-stone-500"
                }`}>
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-stone-900 leading-tight">{ach.title}</h4>
                  <span className="text-[9px] font-mono font-semibold text-stone-500 block mt-1">
                    {ach.progress_text}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 13: RECOMMENDATIONS ("HOW TO EARN MORE") */}
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-800 block mb-1">
              Maximize Your Rewards
            </span>
            <h2 className="text-2xl font-serif text-stone-900">How to Earn More Points</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recommendations.map((rec) => (
              <div key={rec.id} className="p-5 bg-stone-50 border border-stone-200 rounded-2xl space-y-3 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full inline-block mb-2">
                    {rec.points_reward_text}
                  </span>
                  <h4 className="text-sm font-bold text-stone-900">{rec.title}</h4>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">{rec.description}</p>
                </div>

                <Link
                  to={rec.action_type === "shop" ? "/shop" : "/account"}
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2 bg-stone-900 text-white text-xs font-semibold rounded-xl hover:bg-stone-800 transition-colors"
                >
                  <span>{rec.action_label}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
