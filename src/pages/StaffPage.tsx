import React, { useState } from 'react';
import { Lock, Mail, KeyRound, LogOut, ShoppingBag } from 'lucide-react';
import {
  auth,
  signInWithEmailAndPassword,
  signOut
} from '../lib/firebase';
import { useSEO } from '../hooks/useSEO';

export const StaffPage: React.FC = () => {
  useSEO({ title: 'Staff Login | Sa and Sha', description: 'Store staff sign-in.' });

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');

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

      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-white rounded-lg border border-stone-200 p-10 text-center">
          <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-stone-900">Record Store Sale</h2>
          <p className="text-sm text-stone-500 mt-2">
            Sale recording is coming soon. Your staff login is working correctly.
          </p>
        </div>
      </div>
    </div>
  );
};
