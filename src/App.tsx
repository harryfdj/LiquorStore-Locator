import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Upload, Package, MapPin, Image as ImageIcon, Edit2, Check, X, AlertCircle, Trash2, ExternalLink, Clipboard, ClipboardCheck, FileText, Menu } from 'lucide-react';
import Barcode from 'react-barcode';
import { Product } from './types';
import { StockVerify } from './components/StockVerify';
import { VerificationReports } from './components/VerificationReports';
import { CameraScanner } from './components/CameraScanner';

export default function App() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'verify' | 'reports'>('inventory');
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [selectedDept, setSelectedDept] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isFetchingImages, setIsFetchingImages] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0 });
  const [uploadMessage, setUploadMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image Selector State
  const [imageSelectorSku, setImageSelectorSku] = useState<string | null>(null);
  const [imageCandidates, setImageCandidates] = useState<string[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);

  // Edit state
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [editLocation, setEditLocation] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');

  // Lazy loading state
  const [visibleCount, setVisibleCount] = useState(20);

  const handleScroll = useCallback(() => {
    if (window.innerHeight + document.documentElement.scrollTop + 200 >= document.documentElement.offsetHeight) {
      setVisibleCount(prev => prev + 20);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const fetchProducts = async (query = '', dept = '') => {
    try {
      let url = `/api/products?q=${encodeURIComponent(query)}`;
      if (dept) url += `&dept=${encodeURIComponent(dept)}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
        setVisibleCount(20); // Reset visible count on new fetch
        
        // Extract unique departments if we haven't yet and we're fetching all
        if (!query && !dept && departments.length === 0) {
          const depts = Array.from(new Set(data.map((p: Product) => p.depname))).filter(Boolean) as string[];
          setDepartments(depts.sort());
        }
      }
    } catch (error) {
      console.error('Failed to fetch products', error);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchProducts(searchQuery, selectedDept);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, selectedDept]);

  const handleResetDatabase = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/products', { method: 'DELETE' });
      if (res.ok) {
        setProducts([]);
        setUploadMessage({ type: 'success', text: 'Database completely cleared.' });
      } else {
        throw new Error('Failed to reset database');
      }
    } catch (error) {
      setUploadMessage({ type: 'error', text: 'Failed to clear database.' });
    } finally {
      setIsResetting(false);
      setShowResetConfirm(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    setUploadMessage(null);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setUploadMessage({ type: 'success', text: `Successfully updated ${data.count} items from CSV.` });
        fetchProducts(searchQuery);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Upload failed');
      }
    } catch (error: any) {
      setUploadMessage({ type: 'error', text: error.message || 'Failed to upload CSV file. Please check the format.' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const batchFetchImages = async () => {
    const productsWithoutImages = products.filter(p => !p.image_url);
    if (productsWithoutImages.length === 0) {
      setUploadMessage({ type: 'success', text: 'All products already have images!' });
      return;
    }

    // Process in batches of 5 to avoid overwhelming the server
    const BATCH_SIZE = 5;
    setIsFetchingImages(true);
    setFetchProgress({ current: 0, total: productsWithoutImages.length });
    setUploadMessage(null);

    let successCount = 0;

    for (let i = 0; i < productsWithoutImages.length; i += BATCH_SIZE) {
      const batch = productsWithoutImages.slice(i, i + BATCH_SIZE);
      
      const promises = batch.map(async (product) => {
        try {
          const res = await fetch(`/api/products/${product.sku}/fetch-image`, { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            // Update local state immediately for this product
            setProducts(prev => prev.map(p => p.sku === product.sku ? { ...p, image_url: data.image_url } : p));
            successCount++;
          }
        } catch (err) {
          console.error(`Failed to fetch image for ${product.sku}`, err);
        }
      });

      await Promise.all(promises);
      setFetchProgress(prev => ({ ...prev, current: Math.min(i + BATCH_SIZE, productsWithoutImages.length) }));
      
      // Small delay between batches
      if (i + BATCH_SIZE < productsWithoutImages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setIsFetchingImages(false);
    setUploadMessage({ type: 'success', text: `Successfully fetched images for ${successCount} products.` });
  };

  const startEditing = (product: Product) => {
    setEditingSku(product.sku);
    setEditLocation(product.location || '');
    setEditImageUrl(product.image_url || '');
  };

  const cancelEditing = () => {
    setEditingSku(null);
    setEditLocation('');
    setEditImageUrl('');
  };

  const saveEdits = async (sku: string) => {
    try {
      const res = await fetch(`/api/products/${sku}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: editLocation, image_url: editImageUrl }),
      });

      if (res.ok) {
        setProducts(products.map(p => 
          p.sku === sku ? { ...p, location: editLocation, image_url: editImageUrl } : p
        ));
        setEditingSku(null);
      }
    } catch (error) {
      console.error('Failed to save edits', error);
    }
  };

  const openImageSelector = async (sku: string) => {
    setImageSelectorSku(sku);
    setIsLoadingCandidates(true);
    setImageCandidates([]);
    try {
      const res = await fetch(`/api/products/${sku}/image-candidates`);
      if (res.ok) {
        const data = await res.json();
        setImageCandidates(data.candidates || []);
      }
    } catch (err) {
      console.error('Failed to fetch candidates', err);
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  const selectImage = async (sku: string, url: string) => {
    const product = products.find(p => p.sku === sku);
    if (!product) return;
    
    try {
      const res = await fetch(`/api/products/${sku}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: product.location || '', image_url: url }),
      });

      if (res.ok) {
        setProducts(products.map(p => 
          p.sku === sku ? { ...p, image_url: url } : p
        ));
        setImageSelectorSku(null);
      }
    } catch (error) {
      console.error('Failed to save selected image', error);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans">
      {/* Header */}
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

                <div>
                  <button
                    onClick={batchFetchImages}
                    disabled={isFetchingImages || isUploading || isResetting}
                    className="flex items-center gap-2 bg-stone-700 hover:bg-stone-600 text-white px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    <ImageIcon className="w-5 h-5" />
                    <span className="hidden sm:inline">
                      {isFetchingImages ? `Fetching (${fetchProgress.current}/${fetchProgress.total})...` : 'Auto-Fetch Images'}
                    </span>
                  </button>
                </div>

                <div>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
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
              onChange={(e) => {
                setSearchQuery(e.target.value);
              }}
              className="w-full pl-10 pr-4 py-2 bg-emerald-800/50 border border-emerald-700 rounded-xl text-white placeholder-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all"
            />
          </div>
          
          <div className="bg-emerald-800/50 rounded-xl border border-emerald-700 shrink-0">
            <CameraScanner 
              onScan={(text) => {
                setSearchQuery(text);
              }} 
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
              
              <select
                value={selectedDept}
                onChange={(e) => { setSelectedDept(e.target.value); setIsSidebarOpen(false); }}
                className="bg-emerald-800 border border-emerald-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 w-full"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>

              <button
                onClick={() => { fileInputRef.current?.click(); setIsSidebarOpen(false); }}
                disabled={isUploading || isFetchingImages || isResetting}
                className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 w-full"
              >
                <Upload className="w-5 h-5" />
                <span>{isUploading ? 'Syncing...' : 'Sync CSV'}</span>
              </button>

              <button
                onClick={() => { batchFetchImages(); setIsSidebarOpen(false); }}
                disabled={isFetchingImages || isUploading || isResetting}
                className="flex items-center gap-3 bg-stone-700 hover:bg-stone-600 text-white px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 w-full"
              >
                <ImageIcon className="w-5 h-5" />
                <span>{isFetchingImages ? `Fetching (${fetchProgress.current}/${fetchProgress.total})...` : 'Auto-Fetch Images'}</span>
              </button>

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'verify' && <StockVerify searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
        {activeTab === 'reports' && <VerificationReports />}
        
        {activeTab === 'inventory' && (
          <>
        {/* Image Selector Modal */}
        {imageSelectorSku && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-4xl w-full shadow-2xl max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold">Select Better Image</h2>
                  <p className="text-sm text-stone-500 mt-1">
                    Searching for: <span className="font-semibold text-stone-700">{products.find(p => p.sku === imageSelectorSku)?.name}</span>
                  </p>
                </div>
                <button onClick={() => setImageSelectorSku(null)} className="text-stone-400 hover:text-stone-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-4 flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    placeholder="Paste image URL here and press Enter..." 
                    className="w-full border border-stone-300 rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value;
                        if (val) selectImage(imageSelectorSku, val);
                      }
                    }}
                  />
                  <ImageIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                </div>
                <button
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) selectImage(imageSelectorSku, text);
                    } catch (err) {
                      console.error('Failed to read clipboard', err);
                      alert('Could not read clipboard. Please paste manually.');
                    }
                  }}
                  className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Clipboard className="w-4 h-4" />
                  Paste & Use
                </button>
                <a 
                  href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent((products.find(p => p.sku === imageSelectorSku)?.name || '') + ' bottle')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Search className="w-4 h-4" />
                  Search Google
                  <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
                </a>
              </div>
              
              {isLoadingCandidates ? (
                <div className="flex-1 flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
                </div>
              ) : (
                <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4 overflow-y-auto p-2">
                  {imageCandidates.map((url, idx) => (
                    <div 
                      key={idx} 
                      className="break-inside-avoid mb-4 border-2 border-transparent hover:border-emerald-500 rounded-xl overflow-hidden cursor-pointer bg-stone-100 flex items-center justify-center group relative"
                      onClick={() => selectImage(imageSelectorSku, url)}
                    >
                      <img 
                        src={url} 
                        alt="Candidate" 
                        className="w-full h-auto object-contain" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/10 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded-lg transition-opacity shadow-sm">
                          Select
                        </span>
                      </div>
                    </div>
                  ))}
                  {imageCandidates.length === 0 && (
                    <div className="col-span-full text-center text-stone-500 py-8">No alternative images found.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reset Confirmation Modal */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <AlertCircle className="w-8 h-8" />
                <h2 className="text-xl font-bold">Clear All Data?</h2>
              </div>
              <p className="text-stone-600 mb-6">
                Are you sure you want to delete all products, locations, and images? This action cannot be undone. You will need to upload a new CSV to restore your inventory.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={isResetting}
                  className="px-4 py-2 rounded-xl font-medium text-stone-600 hover:bg-stone-100 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetDatabase}
                  disabled={isResetting}
                  className="px-4 py-2 rounded-xl font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isResetting ? 'Deleting...' : 'Yes, Delete Everything'}
                </button>
              </div>
            </div>
          </div>
        )}

        {uploadMessage && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${uploadMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
            {uploadMessage.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <p className="font-medium">{uploadMessage.text}</p>
            <button onClick={() => setUploadMessage(null)} className="ml-auto"><X className="w-5 h-5 opacity-50 hover:opacity-100" /></button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.slice(0, visibleCount).map((product) => (
            <div key={product.sku} className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
              
              {/* Product Image Area */}
              <div className="h-48 bg-stone-100 relative border-b border-stone-200 flex items-center justify-center overflow-hidden">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-contain p-4" referrerPolicy="no-referrer" />
                ) : (
                  <div className="text-stone-400 flex flex-col items-center">
                    <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                    <span className="text-sm font-medium">No Image</span>
                  </div>
                )}
                
                {/* Location Badge */}
                <div className="absolute top-3 right-3">
                  {product.location ? (
                    <div className="bg-emerald-500 text-white px-3 py-1 rounded-lg font-bold shadow-sm flex items-center gap-1.5 border border-emerald-600">
                      <MapPin className="w-4 h-4" />
                      Rack {product.location}
                    </div>
                  ) : (
                    <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-lg font-bold shadow-sm flex items-center gap-1.5 border border-amber-200 text-xs">
                      <MapPin className="w-3 h-3" />
                      No Location
                    </div>
                  )}
                </div>
              </div>

              {/* Product Info */}
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg leading-tight text-stone-800 line-clamp-2" title={product.name}>
                    {product.name}
                  </h3>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
                  <span className="bg-stone-100 px-2 py-0.5 rounded-md font-mono text-xs border border-stone-200">SKU: {product.sku}</span>
                  <span>•</span>
                  <span>{product.size}</span>
                  {product.category && (
                    <>
                      <span>•</span>
                      <span className="truncate">{product.category}</span>
                    </>
                  )}
                  {product.depname && (
                    <>
                      <span>•</span>
                      <span className="truncate">{product.depname}</span>
                    </>
                  )}
                </div>

                <div className="mt-auto grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                    <div className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-1">Stock</div>
                    <div className={`text-xl font-bold ${(product.stock || 0) <= 5 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {product.stock ?? 0}
                    </div>
                  </div>
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                    <div className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-1">Price</div>
                    <div className="text-xl font-bold text-stone-800">
                      ${Number(product.price || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {product.mainupc && (
                  <div className="flex justify-center mb-4 p-2 bg-stone-50 rounded-xl border border-stone-100 overflow-hidden">
                    <div className="flex flex-col items-center scale-75 origin-center">
                      <Barcode value={product.mainupc} format="CODE128" width={1.5} height={40} fontSize={12} background="transparent" />
                    </div>
                  </div>
                )}

                {/* Edit Section */}
                {editingSku === product.sku ? (
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-3 mt-2">
                    <div>
                      <label className="text-xs font-medium text-stone-500 block mb-1">Rack Location (e.g., 4B)</label>
                      <input 
                        type="text" 
                        value={editLocation} 
                        onChange={e => setEditLocation(e.target.value.toUpperCase())}
                        className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        placeholder="e.g. 4B"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-stone-500 block mb-1">Image URL</label>
                      <input 
                        type="text" 
                        value={editImageUrl} 
                        onChange={e => setEditImageUrl(e.target.value)}
                        className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        placeholder="https://..."
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => saveEdits(product.sku)} className="flex-1 bg-emerald-600 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">Save</button>
                      <button onClick={cancelEditing} className="flex-1 bg-stone-200 text-stone-700 py-1.5 rounded-lg text-sm font-medium hover:bg-stone-300 transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => startEditing(product)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button 
                      onClick={() => openImageSelector(product.sku)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
                    >
                      <Search className="w-4 h-4" />
                      Find Image
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {products.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-stone-500">
              <Package className="w-16 h-16 mb-4 opacity-20" />
              <h2 className="text-xl font-medium text-stone-700 mb-2">No products found</h2>
              <p>Upload your inventory CSV to get started, or try a different search.</p>
            </div>
          )}
        </div>
          </>
        )}
      </main>
    </div>
  );
}
