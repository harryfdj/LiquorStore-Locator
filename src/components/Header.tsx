import React from 'react';
import { Package, Search, Upload, Menu, X, Trash2, Image as ImageIcon, ClipboardCheck, FileText, Settings } from 'lucide-react';
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
    <header className="bg-emerald-900 text-white shadow-md sticky top-0 z-10">
      {/* Desktop Header */}
      <div className="hidden sm:flex max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <Package className="w-8 h-8 text-emerald-400" />
          <h1 className="text-2xl font-bold tracking-tight">LiquorStore Locator</h1>
        </div>
        
        <div className="flex bg-emerald-800/50 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'inventory' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-100 hover:bg-emerald-700/50'}`}
          >
            <Package className="w-4 h-4" /> Inventory
          </button>
          <button 
            onClick={() => setActiveTab('verify')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'verify' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-100 hover:bg-emerald-700/50'}`}
          >
            <ClipboardCheck className="w-4 h-4" /> Stock Verify
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'reports' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-100 hover:bg-emerald-700/50'}`}
          >
            <FileText className="w-4 h-4" /> Reports
          </button>
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto flex-wrap justify-end">
          <div className="relative flex-1 sm:w-64 min-w-[200px] flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-200" />
              <input
                type="text"
                placeholder="Search name, SKU, UPC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-emerald-800/50 border border-emerald-700 rounded-xl text-white placeholder-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all"
              />
            </div>
            <div className="bg-emerald-800/50 rounded-xl border border-emerald-700">
              <CameraScanner 
                onScan={(text) => setSearchQuery(text)} 
                isScanning={isScanning} 
                setIsScanning={setIsScanning} 
                buttonClassName={`p-2.5 rounded-xl flex items-center justify-center transition-colors ${
                  isScanning 
                    ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' 
                    : 'text-emerald-200 hover:bg-emerald-700/50'
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
              className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition-colors border ${showAdminPanel ? 'bg-emerald-700 text-white border-emerald-600' : 'bg-emerald-800/50 text-emerald-100 hover:bg-emerald-700/50 border-emerald-700'}`}
              title="Database Settings"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Admin Dropdown */}
            {showAdminPanel && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-stone-200 overflow-hidden z-20 flex flex-col">
                <div className="p-3 bg-stone-50 border-b border-stone-200">
                  <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Admin Actions</h3>
                  <p className="text-xs text-stone-400 mt-0.5">Manage your local database.</p>
                </div>
                
                <div className="p-2 space-y-1">
                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                      setShowAdminPanel(false);
                    }}
                    disabled={isUploading || isFetchingImages}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-50 text-left"
                  >
                    <Upload className="w-4 h-4" />
                    {isUploading ? 'Syncing...' : 'Sync CSV Inventory'}
                  </button>

                  {isFetchingImages ? (
                    <div className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-red-700 bg-red-50">
                      <button onClick={stopFetchImages} className="flex items-center gap-3 hover:text-red-900 transition-colors">
                        <X className="w-4 h-4" /> Stop Fetch
                      </button>
                      <span className="text-xs">{fetchProgress.current}/{fetchProgress.total}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        batchFetchImages();
                        setShowAdminPanel(false);
                      }}
                      disabled={isUploading}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-50 text-left"
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
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-emerald-100 hover:text-white">
          <Menu className="w-7 h-7" />
        </button>
        
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-200" />
          <input
            type="text"
            placeholder="Search name, SKU, UPC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-emerald-800/50 border border-emerald-700 rounded-xl text-white placeholder-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all"
          />
        </div>
        
        <div className="bg-emerald-800/50 rounded-xl border border-emerald-700 shrink-0">
          <CameraScanner 
            onScan={(text) => setSearchQuery(text)} 
            isScanning={isScanning} 
            setIsScanning={setIsScanning} 
            buttonClassName={`p-2 rounded-xl flex items-center justify-center transition-colors ${
              isScanning 
                ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' 
                : 'text-emerald-200 hover:bg-emerald-700/50'
            }`}
          />
        </div>
      </div>
    </header>
  );
};
