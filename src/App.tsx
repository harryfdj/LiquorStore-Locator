import React, { Suspense, lazy, useState, useEffect } from 'react';
import { Check, X, AlertCircle } from 'lucide-react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { useInventory } from './hooks/useInventory';
import { usePhysicalScanner } from './hooks/usePhysicalScanner';

import { LoginScreen } from './components/LoginScreen';
import { GeoFence } from './components/GeoFence';
import { LogOut } from 'lucide-react';
import { apiJson, clearStoredSession } from './lib/api';
import { AuthUser } from './types';

const StockVerify = lazy(() =>
  import('./components/StockVerify').then(module => ({ default: module.StockVerify })),
);
const VerificationReports = lazy(() =>
  import('./components/VerificationReports').then(module => ({ default: module.VerificationReports })),
);
const InventoryTab = lazy(() =>
  import('./components/InventoryTab').then(module => ({ default: module.InventoryTab })),
);
const ImageSelectorModal = lazy(() =>
  import('./components/ImageSelectorModal').then(module => ({ default: module.ImageSelectorModal })),
);
const AdminDashboard = lazy(() =>
  import('./components/AdminDashboard').then(module => ({ default: module.AdminDashboard })),
);

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('user_role') as 'admin' | 'store';
    const storeName = localStorage.getItem('store_name') || undefined;
    if (token && role) return { token, role, storeName };
    return null;
  });

  useEffect(() => {
    const expire = () => setUser(null);
    window.addEventListener('auth:expired', expire);
    return () => window.removeEventListener('auth:expired', expire);
  }, []);

  const handleLogin = (data: AuthUser) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user_role', data.role);
    if (data.storeName) localStorage.setItem('store_name', data.storeName);
    setUser(data);
  };

  const handleLogout = () => {
    clearStoredSession();
    setUser(null);
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (user.role === 'admin') {
    return (
      <Suspense fallback={<div className="min-h-screen grid place-items-center text-stone-500">Loading admin dashboard...</div>}>
        <AdminDashboard token={user.token} onLogout={handleLogout} />
      </Suspense>
    );
  }

  return <StoreApp user={user} onLogout={handleLogout} />;
}

function StoreApp({ user, onLogout }: { user: AuthUser, onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<'inventory' | 'verify' | 'reports'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [storeConfig, setStoreConfig] = useState<any>({
    lat: user.lat,
    lng: user.lng,
    radiusMiles: user.radius_miles
  });

  const inventory = useInventory(searchQuery);

  useEffect(() => {
    apiJson<AuthUser>('/api/auth/me')
      .then(data => {
        if (data.role === 'store') {
          setStoreConfig({
            lat: data.lat,
            lng: data.lng,
            radiusMiles: data.radius_miles
          });
        }
      })
      .catch(e => console.error("Could not fetch store config", e));
  }, []);

  // Global Physical Barcode Scanner listener
  usePhysicalScanner((barcode) => {
    setSearchQuery(barcode);
  });

  return (
    <GeoFence storeLat={storeConfig.lat} storeLng={storeConfig.lng} radiusMiles={storeConfig.radiusMiles}>
      <div className="min-h-screen text-slate-950 font-sans">
        <div className="bg-slate-950 text-slate-300 text-xs py-1.5 px-4 text-center flex justify-between items-center sm:px-8">
          <span className="font-medium">Connected to: <strong className="text-white">{user.storeName}</strong></span>
          <button onClick={onLogout} className="flex items-center gap-1.5 hover:text-white transition-colors">
            <LogOut className="w-3 h-3" /> Disconnect
          </button>
        </div>
      <Header
        activeTab={activeTab} setActiveTab={setActiveTab}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        isScanning={isScanning} setIsScanning={setIsScanning}
        isUploading={inventory.isUploading} isFetchingImages={inventory.isFetchingImages}
        fetchProgress={inventory.fetchProgress}
        batchFetchImages={inventory.batchFetchImages} stopFetchImages={inventory.stopFetchImages}
        fileInputRef={inventory.fileInputRef} handleFileUpload={inventory.handleFileUpload as any}
        setIsSidebarOpen={setIsSidebarOpen} showAdminPanel={inventory.showAdminPanel} setShowAdminPanel={inventory.setShowAdminPanel}
      />

      <Sidebar
        isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}
        activeTab={activeTab} setActiveTab={setActiveTab}
        isUploading={inventory.isUploading} isFetchingImages={inventory.isFetchingImages}
        fetchProgress={inventory.fetchProgress}
        batchFetchImages={inventory.batchFetchImages} stopFetchImages={inventory.stopFetchImages}
        fileInputRef={inventory.fileInputRef}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'verify' && (
          <Suspense fallback={<div className="text-center py-10 text-stone-500">Loading verify tools...</div>}>
            <StockVerify searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
          </Suspense>
        )}
        {activeTab === 'reports' && (
          <Suspense fallback={<div className="text-center py-10 text-stone-500">Loading reports...</div>}>
            <VerificationReports />
          </Suspense>
        )}

        {activeTab === 'inventory' && (
          <Suspense fallback={<div className="text-center py-10 text-stone-500">Loading inventory...</div>}>
            <>
              <ImageSelectorModal
                imageSelectorSku={inventory.imageSelectorSku!}
                imageCandidates={inventory.imageCandidates}
                isLoadingCandidates={inventory.isLoadingCandidates}
                products={inventory.products}
                setImageSelectorSku={inventory.setImageSelectorSku}
                selectImage={inventory.selectImage}
              />

              {inventory.uploadMessage && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${inventory.uploadMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                  {inventory.uploadMessage.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  <p className="font-medium">{inventory.uploadMessage.text}</p>
                  <button onClick={() => inventory.setUploadMessage(null)} className="ml-auto"><X className="w-5 h-5 opacity-50 hover:opacity-100" /></button>
                </div>
              )}

              <InventoryTab
                products={inventory.products}
                visibleCount={inventory.visibleCount}
                selectedDept={inventory.selectedDept}
                setSelectedDept={inventory.setSelectedDept}
                departments={inventory.departments}
                editingSku={inventory.editingSku}
                editLocation={inventory.editLocation} setEditLocation={inventory.setEditLocation}
                editImageUrl={inventory.editImageUrl} setEditImageUrl={inventory.setEditImageUrl}
                editAltUpcs={inventory.editAltUpcs} setEditAltUpcs={inventory.setEditAltUpcs}
                startEditing={inventory.startEditing}
                cancelEditing={inventory.cancelEditing}
                saveEdits={inventory.saveEdits}
                openImageSelector={inventory.openImageSelector}
              />
            </>
          </Suspense>
        )}
      </main>
    </div>
    </GeoFence>
  );
}
