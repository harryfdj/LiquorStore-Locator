import React, { useState, useEffect } from 'react';
import { Package, Store, Plus, Trash2, Shield, LogOut, Check, Lock, ChevronRight } from 'lucide-react';

interface AdminDashboardProps {
  token: string;
  onLogout: () => void;
}

import { AdminConfirmModal } from './AdminConfirmModal';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ token, onLogout }) => {
  const [stores, setStores] = useState<any[]>([]);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStorePassword, setNewStorePassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'clear' | 'delete' | null;
    store: any | null;
    isLoading: boolean;
  }>({
    isOpen: false,
    type: null,
    store: null,
    isLoading: false
  });

  const fetchStores = async () => {
    try {
      const res = await fetch('/api/admin/stores', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setStores(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, [token]);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName || !newStorePassword) return setError('Both store name and password are required');
    
    setError('');
    setSuccessMsg('');
    
    try {
      const res = await fetch('/api/admin/stores', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ name: newStoreName, password: newStorePassword })
      });
      
      const data = await res.json();
      if (res.ok) {
        setStores([data, ...stores]);
        setNewStoreName('');
        setNewStorePassword('');
        setSuccessMsg(`Successfully created new isolated store: ${data.name}`);
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError('Network error');
    }
  };

  const confirmAction = async () => {
    if (!modalConfig.store || !modalConfig.type) return;

    setModalConfig(prev => ({ ...prev, isLoading: true }));
    const { store, type } = modalConfig;

    try {
      if (type === 'delete') {
        const res = await fetch(`/api/admin/stores/${store.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setStores(stores.filter(s => s.id !== store.id));
        } else {
          alert('Failed to delete store');
        }
      } else if (type === 'clear') {
        const res = await fetch(`/api/admin/stores/${store.id}/data`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setSuccessMsg(`Successfully cleared all data for ${store.name}`);
          setTimeout(() => setSuccessMsg(''), 3000);
        } else {
          alert('Failed to clear store data');
        }
      }
    } catch (e) {
      alert('Network error');
    } finally {
      setModalConfig({ isOpen: false, type: null, store: null, isLoading: false });
    }
  };

  const openConfirmModal = (store: any, type: 'clear' | 'delete') => {
    setModalConfig({
      isOpen: true,
      type,
      store,
      isLoading: false
    });
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans pb-12">
      <header className="bg-stone-900 flex items-center justify-between p-4 shadow-md sticky top-0 z-20 text-white border-b-4 border-emerald-500">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-emerald-400" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Master Admin Dashboard</h1>
            <p className="text-xs text-stone-400">Manage Multi-Tenant Database Architecture</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="bg-stone-800 hover:bg-stone-700 text-stone-200 px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
        >
          Logout <LogOut className="w-4 h-4" />
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8 flex flex-col gap-6">
        
        {/* Create Store Flow */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="p-5 bg-gradient-to-r from-emerald-50 to-white border-b border-stone-200">
            <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" /> Spawn New Isolated Store
            </h2>
            <p className="text-sm text-stone-500 mt-1">
              Creates a brand new separate database file (`store_X.db`) completely isolated from all other locations.
            </p>
          </div>
          
          <div className="p-6">
            {error && <div className="mb-4 text-sm font-medium text-red-700 bg-red-50 px-4 py-3 rounded-xl border border-red-200">{error}</div>}
            {successMsg && <div className="mb-4 text-sm font-medium text-emerald-700 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-200 flex items-center gap-2"><Check className="w-5 h-5"/> {successMsg}</div>}

            <form onSubmit={handleCreateStore} className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="text-sm font-bold text-stone-600 block mb-1.5 ml-1">Store Username (Identifier)</label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    value={newStoreName}
                    onChange={e => setNewStoreName(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-shadow"
                    placeholder="e.g. HillTop Store 1"
                  />
                </div>
              </div>
              <div className="flex-1 w-full">
                <label className="text-sm font-bold text-stone-600 block mb-1.5 ml-1">Employee Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    value={newStorePassword}
                    onChange={e => setNewStorePassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-shadow font-mono text-sm"
                    placeholder="e.g. secret-pwd"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full sm:w-auto mt-2 sm:mt-0 px-6 py-2.5 bg-stone-900 border-2 border-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 whitespace-nowrap"
              >
                Launch DB
              </button>
            </form>
          </div>
        </section>

        {/* Store List */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200">
          <div className="p-5 border-b border-stone-200 flex justify-between items-center bg-stone-50 rounded-t-2xl">
            <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
              <Package className="w-5 h-5 text-stone-500" /> Active Store Databases
            </h2>
            <span className="bg-stone-200 text-stone-600 px-3 py-1 rounded-full text-xs font-bold leading-none select-none">
              {stores.length} DBs ACTIVE
            </span>
          </div>

          <div className="divide-y divide-stone-100">
            {loading ? (
              <div className="p-8 text-center text-stone-400 font-medium">Fetching databases...</div>
            ) : stores.length === 0 ? (
              <div className="p-12 text-center text-stone-500 flex flex-col items-center">
                <Store className="w-12 h-12 text-stone-300 mb-3" />
                <h3 className="font-bold text-lg text-stone-400">No stores created</h3>
                <p className="text-sm">Use the form above to deploy your first isolated tenant.</p>
              </div>
            ) : (
              stores.map(store => (
                <div key={store.id} className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-stone-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center font-bold text-xl shadow-inner border border-emerald-200 shrink-0 select-none">
                      {store.id}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg tracking-tight leading-tight">{store.name}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs font-mono text-stone-500">
                        <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-stone-400" /> PWD: {store.password}</span>
                        <span className="text-stone-300">•</span>
                        <span>store_{store.id}.db</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3 sm:mt-0 sl:ml-auto">
                    <button
                      onClick={() => openConfirmModal(store, 'clear')}
                      className="p-2 sm:px-4 sm:py-2 text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors font-semibold text-sm border border-stone-200 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Clear Data</span>
                    </button>
                    <button
                      onClick={() => openConfirmModal(store, 'delete')}
                      className="p-2 sm:px-4 sm:py-2 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-xl transition-colors font-semibold text-sm border border-red-200 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Delete Tenant</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <AdminConfirmModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        onConfirm={confirmAction}
        isLoading={modalConfig.isLoading}
        title={modalConfig.type === 'delete' ? 'Delete Store Permanently?' : 'Clear All Store Data?'}
        message={
          modalConfig.type === 'delete' 
            ? `Are you extremely sure you want to completely DELETE the store "${modalConfig.store?.name}"? This will erase all products, images, and reports permanently. This action cannot be undone.`
            : `Are you sure you want to clear all data for "${modalConfig.store?.name}"? This will delete all products, images, and reports, but the store account will remain active.`
        }
        confirmText={modalConfig.type === 'delete' ? 'Delete Permanently' : 'Clear All Data'}
        variant={modalConfig.type === 'delete' ? 'danger' : 'warning'}
      />
    </div>
  );
};
