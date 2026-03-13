import React, { useState } from 'react';
import { Check, X, AlertCircle } from 'lucide-react';
import { StockVerify } from './components/StockVerify';
import { VerificationReports } from './components/VerificationReports';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { InventoryTab } from './components/InventoryTab';
import { ImageSelectorModal } from './components/ImageSelectorModal';
import { useInventory } from './hooks/useInventory';
import { usePhysicalScanner } from './hooks/usePhysicalScanner';

import { LoginScreen } from './components/LoginScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { LogOut } from 'lucide-react';

// Setup Global Fetch Interceptor for Auth Token
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const token = localStorage.getItem('token');
  if (token) {
    if (args[1]) {
      args[1].headers = { ...args[1].headers, Authorization: `Bearer ${token}` };
    } else {
      args[1] = { headers: { Authorization: `Bearer ${token}` } };
    }
  }
  const response = await originalFetch(...args);
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('store_name');
    window.location.reload();
  }
  return response;
};

export default function App() {
  const [user, setUser] = useState<{ role: 'admin' | 'store', token: string, storeName?: string } | null>(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('user_role') as 'admin' | 'store';
    const storeName = localStorage.getItem('store_name') || undefined;
    if (token && role) return { token, role, storeName };
    return null;
  });

  const handleLogin = (data: { token: string; role: 'admin' | 'store'; storeName?: string }) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user_role', data.role);
    if (data.storeName) localStorage.setItem('store_name', data.storeName);
    setUser(data);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('store_name');
    setUser(null);
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (user.role === 'admin') {
    return <AdminDashboard token={user.token} onLogout={handleLogout} />;
  }

  return <StoreApp user={user} onLogout={handleLogout} />;
}

function StoreApp({ user, onLogout }: { user: any, onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<'inventory' | 'verify' | 'reports'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const inventory = useInventory(searchQuery);

  // Global Physical Barcode Scanner listener
  usePhysicalScanner((barcode) => {
    setSearchQuery(barcode);
  });

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans">
      <div className="bg-emerald-950 text-emerald-100 text-xs py-1.5 px-4 text-center flex justify-between items-center sm:px-8">
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
        {activeTab === 'verify' && <StockVerify searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
        {activeTab === 'reports' && <VerificationReports />}

        {activeTab === 'inventory' && (
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
        )}
      </main>
    </div>
  );
}
