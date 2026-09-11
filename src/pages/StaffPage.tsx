import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Lock, Mail, KeyRound, LogOut, ShoppingBag, Search, Trash2, Plus, Minus, Loader2, CheckCircle2, Receipt } from 'lucide-react';
import {
  auth,
  signInWithEmailAndPassword,
  signOut
} from '../lib/firebase';
import { useShop } from '../context/ShopContext';
import { useSEO } from '../hooks/useSEO';

const PAYMENT_METHODS: Array<{ value: string; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' }
];

interface SaleLine {
  product_id: string;
  name: string;
  sku?: string;
  size: string;
  availableSizes: string[];
  listedPrice: number;
  unit_price: number;
  quantity: number;
}

export const StaffPage: React.FC = () => {
  useSEO({ title: 'Staff Login | Sa and Sha', description: 'Store staff sign-in.' });
  const { products } = useShop();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Record Sale state
  const [searchQuery, setSearchQuery] = useState('');
  const [saleLines, setSaleLines] = useState<SaleLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saleError, setSaleError] = useState('');
  const [lastSaleConfirmation, setLastSaleConfirmation] = useState<{ order_id: string; invoice_number: string | null; grand_total: number } | null>(null);

  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoading(true);

    try {
      const userCred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const token = await userCred.user.getIdToken();

      const res = await fetch('/api/staff/verify-login', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        await signOut(auth);
        setAuthError(data.error || 'This account does not have store access.');
        setIsLoading(false);
        return;
      }

      setStaffName(data.name || data.email || 'Staff');
      setStaffEmail(data.email || '');
      setIsLoggedIn(true);
    } catch (err: any) {
      console.error('Staff login failed:', err);
      setAuthError('Incorrect email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsLoggedIn(false);
    setEmail('');
    setPassword('');
  };

  const getAuthToken = async (): Promise<string> => {
    if (!auth.currentUser) throw new Error('Not signed in.');
    return auth.currentUser.getIdToken();
  };

  const loadRecentSales = useCallback(async () => {
    setIsLoadingSales(true);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/staff/sales', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data.success) {
        setRecentSales(data.sales || []);
      }
    } catch (err) {
      console.error('Failed to load recent sales:', err);
    } finally {
      setIsLoadingSales(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) loadRecentSales();
  }, [isLoggedIn, loadRecentSales]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [searchQuery, products]);

  const addProductToSale = (product: (typeof products)[number]) => {
    const defaultSize = product.sizes && product.sizes.length > 0 ? product.sizes[0] : 'Free Size';
    setSaleLines(prev => {
      const existingIdx = prev.findIndex(l => l.product_id === product.id && l.size === defaultSize);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], quantity: next[existingIdx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          size: defaultSize,
          availableSizes: product.sizes && product.sizes.length > 0 ? product.sizes : ['Free Size'],
          listedPrice: product.price,
          unit_price: product.price,
          quantity: 1
        }
      ];
    });
    setSearchQuery('');
  };

  const updateLine = (index: number, patch: Partial<SaleLine>) => {
    setSaleLines(prev => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const removeLine = (index: number) => {
    setSaleLines(prev => prev.filter((_, i) => i !== index));
  };

  const grandTotal = saleLines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);

  const resetSaleForm = () => {
    setSaleLines([]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setPaymentMethod('cash');
  };

  const handleCompleteSale = async () => {
    setSaleError('');
    if (saleLines.length === 0) {
      setSaleError('Add at least one item to the sale.');
      return;
    }
    setIsSubmitting(true);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/staff/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          items: saleLines.map(l => ({
            product_id: l.product_id,
            size: l.size,
            quantity: l.quantity,
            unit_price: l.unit_price
          })),
          payment_method: paymentMethod,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail
        })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setSaleError(data.error || 'Failed to record sale.');
        setIsSubmitting(false);
        return;
      }

      setLastSaleConfirmation({
        order_id: data.sale.order_id,
        invoice_number: data.invoice_number,
        grand_total: data.sale.grand_total
      });
      resetSaleForm();
      loadRecentSales();
    } catch (err) {
      console.error('Failed to record sale:', err);
      setSaleError('Failed to record sale. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[#B08D57] to-[#8a6d43]" />
          <div className="p-8">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-stone-900 flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-serif text-stone-900">Sa and Sha Store</h1>
              <p className="text-sm text-stone-500 mt-1">Staff sign-in for recording store sales</p>
            </div>

            {authError && (
              <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-1">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
                    placeholder="staff@sa-and-sha.com"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-1">Password</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-stone-900 text-white text-sm font-semibold rounded-md hover:bg-stone-800 disabled:opacity-60 transition"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-serif text-stone-900">Sa and Sha Store</h1>
          <p className="text-xs text-stone-500">Signed in as {staffName} ({staffEmail})</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 border border-stone-300 rounded-md px-3 py-1.5"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {lastSaleConfirmation && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-green-800">Sale recorded — #{lastSaleConfirmation.order_id}</p>
              <p className="text-green-700">
                Total ₹{lastSaleConfirmation.grand_total.toFixed(2)}
                {lastSaleConfirmation.invoice_number ? ` · Invoice ${lastSaleConfirmation.invoice_number}` : ' · Invoice pending'}
              </p>
            </div>
            <button onClick={() => setLastSaleConfirmation(null)} className="text-green-700 text-xs underline">Dismiss</button>
          </div>
        )}

        <div className="bg-white rounded-lg border border-stone-200 p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-500 mb-4 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" /> Record Store Sale
          </h2>

          <div className="relative mb-4">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product by name or SKU..."
              className="w-full pl-10 pr-3 py-2.5 border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
            {searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-stone-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
                {searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addProductToSale(p)}
                    className="w-full text-left px-4 py-2.5 hover:bg-stone-50 flex items-center justify-between text-sm border-b border-stone-100 last:border-0"
                  >
                    <span className="text-stone-800">{p.name}</span>
                    <span className="text-stone-500">₹{p.price}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {saleLines.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-6">Search and add products to start a sale.</p>
          ) : (
            <div className="space-y-3 mb-4">
              {saleLines.map((line, idx) => (
                <div key={`${line.product_id}-${line.size}-${idx}`} className="flex items-center gap-3 border border-stone-100 rounded-md p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">{line.name}</p>
                    {line.availableSizes.length > 1 || line.availableSizes[0] !== 'Free Size' ? (
                      <select
                        value={line.size}
                        onChange={(e) => updateLine(idx, { size: e.target.value })}
                        className="text-xs border border-stone-200 rounded px-1.5 py-0.5 mt-1"
                      >
                        {line.availableSizes.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span className="text-xs text-stone-400">Free Size</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateLine(idx, { quantity: Math.max(1, line.quantity - 1) })} className="p-1 border border-stone-200 rounded">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm">{line.quantity}</span>
                    <button onClick={() => updateLine(idx, { quantity: line.quantity + 1 })} className="p-1 border border-stone-200 rounded">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      min={0}
                      max={line.listedPrice}
                      value={line.unit_price}
                      onChange={(e) => updateLine(idx, { unit_price: Math.min(Number(e.target.value) || 0, line.listedPrice) })}
                      className="w-full text-sm border border-stone-200 rounded px-2 py-1"
                    />
                  </div>
                  <div className="w-20 text-right text-sm font-semibold text-stone-900">
                    ₹{(line.unit_price * line.quantity).toFixed(0)}
                  </div>
                  <button onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name (optional)" className="border border-stone-300 rounded-md px-3 py-2 text-sm" />
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone (optional)" className="border border-stone-300 rounded-md px-3 py-2 text-sm" />
            <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="Email (optional)" className="border border-stone-300 rounded-md px-3 py-2 text-sm" />
          </div>

          <div className="flex items-center gap-2 mb-4">
            {PAYMENT_METHODS.map(m => (
              <button
                key={m.value}
                onClick={() => setPaymentMethod(m.value)}
                className={`px-4 py-2 rounded-md text-sm font-medium border ${paymentMethod === m.value ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-300 text-stone-600'}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {saleError && <p className="text-sm text-red-600 mb-3">{saleError}</p>}

          <div className="flex items-center justify-between border-t border-stone-100 pt-4">
            <span className="text-lg font-semibold text-stone-900">Total: ₹{grandTotal.toFixed(2)}</span>
            <button
              onClick={handleCompleteSale}
              disabled={isSubmitting || saleLines.length === 0}
              className="bg-[#B08D57] text-white text-sm font-semibold px-6 py-2.5 rounded-md disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
              {isSubmitting ? 'Saving...' : 'Complete Sale'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-stone-200 p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-500 mb-4">Recent Sales</h2>
          {isLoadingSales ? (
            <p className="text-sm text-stone-400 text-center py-4">Loading...</p>
          ) : recentSales.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-4">No sales recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {recentSales.map((sale) => (
                <div key={sale.order_id} className="flex items-center justify-between text-sm border-b border-stone-100 py-2 last:border-0">
                  <div>
                    <span className="font-medium text-stone-800">#{sale.order_id}</span>
                    <span className="text-stone-400 ml-2">{new Date(sale.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-stone-600">
                    {sale.items?.length || 0} item(s) · ₹{Number(sale.grand_total || 0).toFixed(0)} · {sale.payment_method}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
