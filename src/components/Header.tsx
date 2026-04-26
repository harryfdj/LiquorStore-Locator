import React from 'react';
import { Package, Search, Upload, Menu, X, Image as ImageIcon, ClipboardCheck, FileText, Settings } from 'lucide-react';
import { CameraScanner } from './CameraScanner';

interface HeaderProps {
  activeTab: 'inventory' | 'verify' | 'reports';
  setActiveTab: (t: 'inventory' | 'verify' | 'reports') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isScanning: boolean;
  setIsScanning: (s: boolean) => void;
  isUploading: boolean;
  isFetchingImages: boolean;
  fetchProgress: { current: number; total: number; found: number };
  batchFetchImages: () => void;
  stopFetchImages: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setIsSidebarOpen: (v: boolean) => void;
  showAdminPanel: boolean;
  setShowAdminPanel: (v: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab, setActiveTab,
  searchQuery, setSearchQuery,
  isScanning, setIsScanning,
  isUploading, isFetchingImages,
  fetchProgress,
  batchFetchImages, stopFetchImages,
  fileInputRef, handleFileUpload,
  setIsSidebarOpen, showAdminPanel, setShowAdminPanel
}) => {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 text-slate-900 shadow-sm shadow-slate-200/60 backdrop-blur-xl">
      {/* Desktop Header */}
      <div className="hidden sm:flex max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lime-300 text-slate-950 shadow-sm">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight leading-tight">LiquorStore Locator</h1>
            <p className="text-xs text-slate-500">Inventory, verification, and weekly reporting</p>
          </div>
        </div>
        
        <div className="flex rounded-2xl border border-slate-200 bg-slate-100/80 p-1">
          <button 
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'inventory' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <Package className="w-4 h-4" /> Inventory
          </button>
          <button 
            onClick={() => setActiveTab('verify')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'verify' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <ClipboardCheck className="w-4 h-4" /> Stock Verify
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'reports' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <FileText className="w-4 h-4" /> Reports
          </button>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap justify-end">
          <div className="relative flex-1 sm:w-64 min-w-[200px] flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, SKU, UPC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="control-input w-full py-2 pl-10 pr-4"
                aria-label="Search inventory by name, SKU, location, or UPC"
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CameraScanner 
                onScan={(text) => setSearchQuery(text)} 
                isScanning={isScanning} 
                setIsScanning={setIsScanning} 
                buttonClassName={`p-2.5 rounded-xl flex items-center justify-center transition-colors ${
                  isScanning 
                    ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              />
            </div>
          </div>

          {/* Admin Panel Toggle - Present everywhere */}
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file as any);
              }}
            />
            
            <button
              onClick={() => setShowAdminPanel(!showAdminPanel)}
              className={`flex items-center gap-2 px-3 py-2 rounded-2xl font-semibold transition-colors border ${showAdminPanel ? 'bg-slate-950 text-white border-slate-950' : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950 border-slate-200 shadow-sm'}`}
              title="Database Settings"
              aria-expanded={showAdminPanel}
              aria-label="Toggle inventory admin controls"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Admin Dropdown */}
            {showAdminPanel && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl shadow-slate-200/80 border border-slate-200 overflow-hidden z-20 flex flex-col">
                <div className="p-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inventory Controls</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Sync products and enrich missing images.</p>
                </div>
                
                <div className="p-2 space-y-1">
                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                      setShowAdminPanel(false);
                    }}
                    disabled={isUploading || isFetchingImages}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-lime-50 hover:text-slate-950 transition-colors disabled:opacity-50 text-left"
                  >
                    <Upload className="w-4 h-4" />
                    {isUploading ? 'Syncing...' : 'Sync CSV Inventory'}
                  </button>

                  {isFetchingImages ? (
                    <div className="w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-700 bg-red-50">
                      <button onClick={stopFetchImages} className="w-full flex items-center justify-between gap-3 hover:text-red-900 transition-colors">
                        <span className="flex items-center gap-3">
                        <X className="w-4 h-4" /> Stop Fetch
                        </span>
                        <span className="text-xs">{fetchProgress.current}/{fetchProgress.total}</span>
                      </button>
                      <p className="mt-2 text-xs text-red-700/80">Found {fetchProgress.found} matching images so far.</p>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        batchFetchImages();
                        setShowAdminPanel(false);
                      }}
                      disabled={isUploading}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-lime-50 hover:text-slate-950 transition-colors disabled:opacity-50 text-left"
                    >
                      <ImageIcon className="w-4 h-4" /> Auto-Fetch Images
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="sm:hidden px-4 py-3 flex items-center justify-between gap-3 w-full">
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-600 hover:text-slate-950">
          <Menu className="w-7 h-7" />
        </button>
        
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, SKU, UPC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="control-input w-full py-2 pl-10 pr-4"
            aria-label="Search inventory"
          />
        </div>
        
        <div className="shrink-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CameraScanner 
            onScan={(text) => setSearchQuery(text)} 
            isScanning={isScanning} 
            setIsScanning={setIsScanning} 
            buttonClassName={`p-2 rounded-xl flex items-center justify-center transition-colors ${
              isScanning 
                ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          />
        </div>
      </div>
    </header>
  );
};
