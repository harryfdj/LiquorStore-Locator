import React from 'react';
import { Package, ClipboardCheck, FileText, Upload, X, Trash2, Image as ImageIcon } from 'lucide-react';

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  activeTab: 'inventory' | 'verify' | 'reports';
  setActiveTab: (t: 'inventory' | 'verify' | 'reports') => void;
  isUploading: boolean;
  isFetchingImages: boolean;
  fetchProgress: { current: number; total: number; found: number };
  batchFetchImages: () => void;
  stopFetchImages: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen, setIsSidebarOpen,
  activeTab, setActiveTab,
  isUploading, isFetchingImages, fetchProgress,
  batchFetchImages, stopFetchImages, fileInputRef
}) => {
  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 sm:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Mobile Sidebar */}
      <div className={`fixed inset-y-0 left-0 w-80 bg-white text-slate-900 z-50 transform transition-transform duration-300 ease-in-out sm:hidden flex flex-col shadow-2xl ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 flex justify-between items-center border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lime-300 text-slate-950">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold leading-tight">Menu</h2>
              <p className="text-xs text-slate-500">Navigate and run inventory actions</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400 hover:text-slate-900">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-6">
          {/* Navigation Tabs */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Navigation</h3>
            <button 
              onClick={() => { setActiveTab('inventory'); setIsSidebarOpen(false); }}
              className={`px-4 py-3 rounded-2xl text-left font-semibold transition-colors flex items-center gap-3 ${activeTab === 'inventory' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}
            >
              <Package className="w-5 h-5" /> Inventory
            </button>
            <button 
              onClick={() => { setActiveTab('verify'); setIsSidebarOpen(false); }}
              className={`px-4 py-3 rounded-2xl text-left font-semibold transition-colors flex items-center gap-3 ${activeTab === 'verify' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}
            >
              <ClipboardCheck className="w-5 h-5" /> Stock Verify
            </button>
            <button 
              onClick={() => { setActiveTab('reports'); setIsSidebarOpen(false); }}
              className={`px-4 py-3 rounded-2xl text-left font-semibold transition-colors flex items-center gap-3 ${activeTab === 'reports' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}
            >
              <FileText className="w-5 h-5" /> Reports
            </button>
          </div>

          {/* Actions */}
          {activeTab === 'inventory' && (
            <div className="surface-panel flex flex-col gap-4 p-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Inventory Actions</h3>

              <button
                onClick={() => { fileInputRef.current?.click(); setIsSidebarOpen(false); }}
                disabled={isUploading || isFetchingImages}
                className="btn-primary flex w-full items-center gap-3 px-4 py-3"
              >
                <Upload className="w-5 h-5" />
                <span>{isUploading ? 'Syncing...' : 'Sync CSV'}</span>
              </button>

              {isFetchingImages ? (
                <>
                  <button
                    onClick={stopFetchImages}
                    className="flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-2xl font-semibold transition-colors w-full"
                  >
                    <X className="w-5 h-5" />
                    <span>Stop Fetching</span>
                  </button>
                  <div className="text-xs text-slate-500 px-1">
                    {fetchProgress.current}/{fetchProgress.total} processed · {fetchProgress.found} matched
                  </div>
                </>
              ) : (
                <button
                  onClick={() => { batchFetchImages(); setIsSidebarOpen(false); }}
                  disabled={isUploading}
                  className="btn-secondary flex w-full items-center gap-3 px-4 py-3"
                >
                  <ImageIcon className="w-5 h-5" />
                  <span>Auto-Fetch Images</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
