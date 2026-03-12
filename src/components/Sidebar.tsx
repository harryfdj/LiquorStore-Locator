import React from 'react';
import { Package, ClipboardCheck, FileText, Upload, X, Trash2, Image as ImageIcon } from 'lucide-react';

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  activeTab: 'inventory' | 'verify' | 'reports';
  setActiveTab: (t: 'inventory' | 'verify' | 'reports') => void;
  isUploading: boolean;
  isFetchingImages: boolean;
  isResetting: boolean;
  showResetConfirm: boolean;
  setShowResetConfirm: (v: boolean) => void;
  fetchProgress: { current: number; total: number; found: number };
  batchFetchImages: () => void;
  stopFetchImages: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen, setIsSidebarOpen,
  activeTab, setActiveTab,
  isUploading, isFetchingImages, isResetting,
  setShowResetConfirm, fetchProgress,
  batchFetchImages, stopFetchImages, fileInputRef
}) => {
  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 sm:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Mobile Sidebar */}
      <div className={`fixed inset-y-0 left-0 w-64 bg-emerald-900 text-white z-50 transform transition-transform duration-300 ease-in-out sm:hidden flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 flex justify-between items-center border-b border-emerald-800">
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-400" />
            <h2 className="text-lg font-bold">Menu</h2>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-emerald-200 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-6">
          {/* Navigation Tabs */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Navigation</h3>
            <button 
              onClick={() => { setActiveTab('inventory'); setIsSidebarOpen(false); }}
              className={`px-4 py-3 rounded-lg text-left font-medium transition-colors flex items-center gap-3 ${activeTab === 'inventory' ? 'bg-emerald-600 text-white' : 'text-emerald-100 hover:bg-emerald-800'}`}
            >
              <Package className="w-5 h-5" /> Inventory
            </button>
            <button 
              onClick={() => { setActiveTab('verify'); setIsSidebarOpen(false); }}
              className={`px-4 py-3 rounded-lg text-left font-medium transition-colors flex items-center gap-3 ${activeTab === 'verify' ? 'bg-emerald-600 text-white' : 'text-emerald-100 hover:bg-emerald-800'}`}
            >
              <ClipboardCheck className="w-5 h-5" /> Stock Verify
            </button>
            <button 
              onClick={() => { setActiveTab('reports'); setIsSidebarOpen(false); }}
              className={`px-4 py-3 rounded-lg text-left font-medium transition-colors flex items-center gap-3 ${activeTab === 'reports' ? 'bg-emerald-600 text-white' : 'text-emerald-100 hover:bg-emerald-800'}`}
            >
              <FileText className="w-5 h-5" /> Reports
            </button>
          </div>

          {/* Actions */}
          {activeTab === 'inventory' && (
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">Inventory Actions</h3>

              <button
                onClick={() => { fileInputRef.current?.click(); setIsSidebarOpen(false); }}
                disabled={isUploading || isFetchingImages || isResetting}
                className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 w-full"
              >
                <Upload className="w-5 h-5" />
                <span>{isUploading ? 'Syncing...' : 'Sync CSV'}</span>
              </button>

              {isFetchingImages ? (
                <>
                  <button
                    onClick={stopFetchImages}
                    className="flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl font-medium transition-colors w-full"
                  >
                    <X className="w-5 h-5" />
                    <span>Stop Fetching</span>
                  </button>
                  <div className="text-xs text-emerald-300 px-1">
                    {fetchProgress.current}/{fetchProgress.total} processed · {fetchProgress.found} found
                  </div>
                </>
              ) : (
                <button
                  onClick={() => { batchFetchImages(); setIsSidebarOpen(false); }}
                  disabled={isUploading || isResetting}
                  className="flex items-center gap-3 bg-stone-700 hover:bg-stone-600 text-white px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 w-full"
                >
                  <ImageIcon className="w-5 h-5" />
                  <span>Auto-Fetch Images</span>
                </button>
              )}

              <button
                onClick={() => { setShowResetConfirm(true); setIsSidebarOpen(false); }}
                disabled={isFetchingImages || isUploading || isResetting}
                className="flex items-center gap-3 bg-red-900/50 hover:bg-red-800 text-red-100 px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 border border-red-800 w-full mt-4"
              >
                <Trash2 className="w-5 h-5" />
                <span>Clear Data</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
