import React, { useState } from 'react';
import { Package, Lock, User, AlertCircle } from 'lucide-react';
import { AuthUser } from '../types';

interface LoginScreenProps {
  onLogin: (data: AuthUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return setError('Please enter both username/store name and password.');
    
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        onLogin(data);
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Network error. Please make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl surface-card overflow-hidden grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden lg:flex min-h-[620px] flex-col justify-between overflow-hidden bg-slate-950 p-10 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(217,249,157,0.35),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(165,180,252,0.22),transparent_24%)]" />
          <div className="relative">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-300 text-slate-950 shadow-sm">
              <Package className="w-7 h-7" />
            </div>
            <h1 className="mt-8 text-4xl font-semibold tracking-tight">LiquorStore Locator</h1>
            <p className="mt-4 max-w-md text-base leading-7 text-slate-300">
              Professional inventory, stock verification, and weekly reporting for multi-store liquor operations.
            </p>
          </div>

          <div className="relative grid grid-cols-3 gap-3">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-2xl font-semibold">Fast</p>
              <p className="mt-1 text-xs text-slate-300">Barcode-first workflows</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-2xl font-semibold">Secure</p>
              <p className="mt-1 text-xs text-slate-300">Supabase-backed access</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-2xl font-semibold">Clear</p>
              <p className="mt-1 text-xs text-slate-300">Weekly reports</p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-10 lg:p-12">
          <div className="mb-10">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-300 text-slate-950 lg:hidden">
              <Package className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lime-700">Secure Access</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Sign in to continue</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Use your admin account or store staff credentials.</p>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Store Name or Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="control-input w-full py-3 pl-12 pr-4"
                  placeholder="e.g. HillTop Store 1"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="control-input w-full py-3 pl-12 pr-4"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex w-full items-center justify-center gap-2 px-4 py-3.5"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Sign In securely'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
