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
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4 selection:bg-emerald-500 selection:text-white">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-stone-200">
        
        <div className="bg-emerald-900 p-8 text-center relative overflow-hidden">
          <div className="relative z-10">
            <div className="mx-auto w-16 h-16 bg-emerald-800 rounded-2xl flex items-center justify-center mb-4 shadow-lg border border-emerald-700">
              <Package className="w-10 h-10 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">System Login</h1>
            <p className="text-emerald-200 text-sm mt-1">LiquorStore Locator Multi-Store</p>
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 rounded-xl flex items-center gap-3 bg-red-50 text-red-800 border border-red-200">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-sm font-semibold text-stone-700 mb-1.5 block">Store Name or Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all shadow-sm"
                  placeholder="e.g. HillTop Store 1"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-stone-700 mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all shadow-sm"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md disabled:opacity-70"
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
