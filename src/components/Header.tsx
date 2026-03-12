import React from 'react';
import { Package, Search, Upload, Menu, X, Trash2, Image as ImageIcon, ClipboardCheck, FileText } from 'lucide-react';
import { CameraScanner } from './CameraScanner';

interface HeaderProps {
  activeTab: 'inventory' | 'verify' | 'reports';
  setActiveTab: (t: 'inventory' | 'verify' | 'reports') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isScanning: boolean;
  setIsScanning: (s: boolean) => void;
  selectedDept: string;
  setSelectedDept: (d: string) => void;
  departments: string[];
  isUploading: boolean;
  isFetchingImages: boolean;
  isResetting: boolean;
  setShowResetConfirm: (v: boolean) => void;
  fetchProgress: { current: number; total: number; found: number };
  batchFetchImages: () => void;
  stopFetchImages: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setIsSidebarOpen: (v: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab, setActiveTab,
  searchQuery, setSearchQuery,
  isScanning, setIsScanning,
  selectedDept, setSelectedDept, departments,
  isUploading, isFetchingImages, isResetting,
  setShowResetConfirm, fetchProgress,
  batchFetchImages, stopFetchImages,
  fileInputRef, handleFileUpload,
  setIsSidebarOpen
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

          {activeTab === 'inventory' && (
            <>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="bg-emerald-800/50 border border-emerald-700 text-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              
              <div>
                <button
                  onClick={() => setShowResetConfirm(true)}
                  disabled={isFetchingImages || isUploading || isResetting}
                  className="flex items-center gap-2 bg-red-900/50 hover:bg-red-800 text-red-100 px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50 border border-red-800"
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="hidden sm:inline">Clear Data</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {isFetchingImages ? (
                  <>
                    <button
                      onClick={stopFetchImages}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-medium transition-colors"
                    >
                      <X className="w-5 h-5" />
                      <span className="hidden sm:inline">Stop</span>
                    </button>
                    <div className="hidden sm:flex flex-col text-xs text-emerald-100 leading-tight">
                      <span>Batch {Math.ceil(fetchProgress.current / 30)}/{Math.ceil(fetchProgress.total / 30)}</span>
                      <span>{fetchProgress.current}/{fetchProgress.total} · {fetchProgress.found} found</span>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={batchFetchImages}
                    disabled={isUploading || isResetting}
                    className="flex items-center gap-2 bg-stone-700 hover:bg-stone-600 text-white px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    <ImageIcon className="w-5 h-5" />
                    <span className="hidden sm:inline">Auto-Fetch Images</span>
                  </button>
                )}
              </div>

              <div>
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
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isFetchingImages || isResetting}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  <Upload className="w-5 h-5" />
                  <span className="hidden sm:inline">{isUploading ? 'Syncing...' : 'Sync CSV'}</span>
                </button>
              </div>
            </>
          )}
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
