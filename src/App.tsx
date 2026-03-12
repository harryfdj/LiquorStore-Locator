import React, { useState } from 'react';
import { Check, X, AlertCircle } from 'lucide-react';
import { StockVerify } from './components/StockVerify';
import { VerificationReports } from './components/VerificationReports';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { InventoryTab } from './components/InventoryTab';
import { ImageSelectorModal } from './components/ImageSelectorModal';
import { ResetConfirmModal } from './components/ResetConfirmModal';
import { useInventory } from './hooks/useInventory';

export default function App() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'verify' | 'reports'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const inventory = useInventory(searchQuery);

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans">
      <Header
        activeTab={activeTab} setActiveTab={setActiveTab}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        isScanning={isScanning} setIsScanning={setIsScanning}
        isUploading={inventory.isUploading} isFetchingImages={inventory.isFetchingImages} isResetting={inventory.isResetting}
        setShowResetConfirm={inventory.setShowResetConfirm} fetchProgress={inventory.fetchProgress}
        batchFetchImages={inventory.batchFetchImages}        stopFetchImages={inventory.stopFetchImages}
        fileInputRef={inventory.fileInputRef} handleFileUpload={inventory.handleFileUpload as any}
        setIsSidebarOpen={setIsSidebarOpen} showAdminPanel={inventory.showAdminPanel} setShowAdminPanel={inventory.setShowAdminPanel}
      />

      <Sidebar
        isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}
        activeTab={activeTab} setActiveTab={setActiveTab}
        isUploading={inventory.isUploading} isFetchingImages={inventory.isFetchingImages} isResetting={inventory.isResetting}
        showResetConfirm={inventory.showResetConfirm} setShowResetConfirm={inventory.setShowResetConfirm}
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

            <ResetConfirmModal
              showResetConfirm={inventory.showResetConfirm}
              setShowResetConfirm={inventory.setShowResetConfirm}
              handleResetDatabase={inventory.handleResetDatabase}
              isResetting={inventory.isResetting}
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
