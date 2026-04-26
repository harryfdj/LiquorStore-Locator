import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, LocateFixed, MapPin, Image as ImageIcon, Edit2, Package, Search, Save, ScanLine, X } from 'lucide-react';
import Barcode from 'react-barcode';
import { Product } from '../types';
import { apiJson } from '../lib/api';
import { proxyUrl } from '../lib/images';

interface InventoryTabProps {
  products: Product[];
  visibleCount: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  editingSku: string | null;
  editLocation: string;
  setEditLocation: (v: string) => void;
  editImageUrl: string;
  setEditImageUrl: (v: string) => void;
  editAltUpcs: string;
  setEditAltUpcs: (v: string) => void;
  startEditing: (p: Product) => void;
  cancelEditing: () => void;
  saveEdits: (sku: string) => void;
  updateProductLocation: (sku: string, location: string) => Promise<void>;
  openImageSelector: (sku: string) => void;
  selectedDept: string;
  setSelectedDept: (d: string) => void;
  departments: string[];
}

type BulkLocationDecision = {
  product: Product;
  targetLocation: string;
  existingLocations: string[];
};

function normalizeLocation(value: string) {
  return value.trim().toUpperCase();
}

function parseLocations(value: string) {
  return value
    .split(',')
    .map(location => normalizeLocation(location))
    .filter(Boolean);
}

function joinLocations(locations: string[]) {
  const unique: string[] = [];
  for (const location of locations) {
    if (!unique.some(existing => existing.toLowerCase() === location.toLowerCase())) {
      unique.push(location);
    }
  }
  return unique.join(', ');
}

export const InventoryTab: React.FC<InventoryTabProps> = ({
  products, visibleCount, searchQuery, setSearchQuery, editingSku, editLocation, setEditLocation,
  editImageUrl, setEditImageUrl, editAltUpcs, setEditAltUpcs, 
  startEditing, cancelEditing, saveEdits, updateProductLocation,
  openImageSelector, selectedDept, setSelectedDept, departments
}) => {
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [bulkLocationMode, setBulkLocationMode] = useState(false);
  const [activeLocation, setActiveLocation] = useState('');
  const [bulkCandidates, setBulkCandidates] = useState<Product[]>([]);
  const [bulkDecision, setBulkDecision] = useState<BulkLocationDecision | null>(null);
  const [bulkMessage, setBulkMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const isCompact = density === 'compact';

  const saveBulkLocation = async (product: Product, location: string) => {
    setIsBulkSaving(true);
    setBulkMessage(null);
    setSearchQuery('');
    try {
      await updateProductLocation(product.sku, location);
      setBulkDecision(null);
      setBulkCandidates([]);
      setBulkMessage({ type: 'success', text: `${product.name} saved to ${location || 'no location'}.` });
    } catch (error) {
      setBulkMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to update location' });
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleBulkLocationProduct = (product: Product) => {
    const targetLocation = normalizeLocation(activeLocation);
    if (!targetLocation) {
      setBulkMessage({ type: 'error', text: 'Enter a location before scanning items.' });
      return;
    }

    const existingLocations = parseLocations(product.location || '');
    if (existingLocations.length === 0) {
      void saveBulkLocation(product, targetLocation);
      return;
    }

    if (existingLocations.some(location => location.toLowerCase() === targetLocation.toLowerCase())) {
      setBulkCandidates([]);
      setBulkDecision(null);
      setSearchQuery('');
      setBulkMessage({ type: 'success', text: `${product.name} is already in ${targetLocation}.` });
      return;
    }

    setBulkCandidates([]);
    setSearchQuery('');
    setBulkDecision({ product, targetLocation, existingLocations });
  };

  useEffect(() => {
    if (!bulkLocationMode || !activeLocation.trim() || !searchQuery.trim()) return;
    if (bulkDecision || isBulkSaving) return;

    const scanValue = searchQuery.trim();
    const timeout = window.setTimeout(async () => {
      setBulkMessage(null);
      setBulkCandidates([]);
      setBulkDecision(null);

      try {
        const data = await apiJson<{ type: 'exact'; product: Product } | { type: 'multiple'; products: Product[] }>(`/api/products/upc/${encodeURIComponent(scanValue)}`);
        if (data.type === 'exact') {
          handleBulkLocationProduct(data.product);
        } else {
          setBulkCandidates(data.products);
          setSearchQuery('');
        }
      } catch (error) {
        setBulkMessage({ type: 'error', text: error instanceof Error ? error.message : 'Product not found for this scan.' });
      }
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [bulkLocationMode, activeLocation, searchQuery, bulkDecision, isBulkSaving]);

  const replaceBulkLocation = (fromLocation: string) => {
    if (!bulkDecision) return;
    const nextLocations = bulkDecision.existingLocations.map(location =>
      location.toLowerCase() === fromLocation.toLowerCase() ? bulkDecision.targetLocation : location
    );
    void saveBulkLocation(bulkDecision.product, joinLocations(nextLocations));
  };

  const addBulkLocation = () => {
    if (!bulkDecision) return;
    void saveBulkLocation(
      bulkDecision.product,
      joinLocations([...bulkDecision.existingLocations, bulkDecision.targetLocation])
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {bulkCandidates.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setBulkCandidates([])}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-candidates-dialog-title"
            className="surface-card relative w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 ease-out"
          >
            <div className="h-2 w-full bg-amber-400" />
            <div className="p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
                    <AlertCircle className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 id="bulk-candidates-dialog-title" className="text-xl font-bold leading-tight text-slate-950">
                      Multiple UPC matches found
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Choose the correct item to apply location{' '}
                      <span className="font-semibold text-lime-700">{normalizeLocation(activeLocation)}</span>.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkCandidates([])}
                  className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close multiple matches popup</span>
                </button>
              </div>

              <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                {bulkCandidates.map(candidate => (
                  <button
                    key={candidate.sku}
                    type="button"
                    onClick={() => handleBulkLocationProduct(candidate)}
                    className="w-full rounded-3xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-lime-300 hover:bg-lime-50"
                  >
                    <div className="flex gap-3">
                      {candidate.image_url ? (
                        <img
                          src={proxyUrl(candidate.image_url)}
                          alt={candidate.name}
                          className="h-16 w-16 shrink-0 rounded-2xl border border-slate-100 bg-slate-50 object-contain p-1"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                          <ImageIcon className="h-6 w-6 text-slate-300" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-snug text-slate-950">{candidate.name}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>SKU <span className="font-mono text-slate-700">{candidate.sku}</span></span>
                          <span>UPC <span className="font-mono text-slate-700">{candidate.mainupc || 'N/A'}</span></span>
                          <span>Location <span className="font-semibold text-slate-700">{candidate.location || 'None'}</span></span>
                        </div>
                        <p className="mt-2 text-xs font-semibold text-lime-700">Select this item</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setBulkCandidates([])}
                className="btn-secondary mt-5 w-full px-4 py-3 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkDecision && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => {
              if (!isBulkSaving) setBulkDecision(null);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-location-dialog-title"
            className="surface-card relative w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 ease-out"
          >
            <div className="h-2 w-full bg-lime-400" />
            <div className="p-6 sm:p-8">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div className="rounded-2xl bg-lime-50 p-3 text-lime-700">
                  <MapPin className="h-8 w-8" />
                </div>
                <button
                  type="button"
                  onClick={() => setBulkDecision(null)}
                  disabled={isBulkSaving}
                  className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                  <span className="sr-only">Cancel location decision</span>
                </button>
              </div>

              <h3 id="bulk-location-dialog-title" className="text-xl font-bold leading-tight text-slate-950">
                This item already has a location
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {bulkDecision.product.name}
              </p>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p>
                  Current locations:{' '}
                  <span className="font-semibold text-slate-950">{bulkDecision.existingLocations.join(', ')}</span>
                </p>
                <p className="mt-1">
                  New scan location:{' '}
                  <span className="font-semibold text-lime-700">{bulkDecision.targetLocation}</span>
                </p>
              </div>

              <div className="mt-6 grid gap-3">
                {bulkDecision.existingLocations.map(location => (
                  <button
                    key={location}
                    type="button"
                    onClick={() => replaceBulkLocation(location)}
                    disabled={isBulkSaving}
                    className="btn-secondary px-4 py-3 text-sm"
                  >
                    Replace {location} with {bulkDecision.targetLocation}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={addBulkLocation}
                  disabled={isBulkSaving}
                  className="btn-accent px-4 py-3 text-sm"
                >
                  Add {bulkDecision.targetLocation} also
                </button>
                <button
                  type="button"
                  onClick={() => setBulkDecision(null)}
                  disabled={isBulkSaving}
                  className="btn-secondary px-4 py-3 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Department Filter Header */}
      <div className="surface-card flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Inventory Catalog</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            {products.length} Items {selectedDept ? <span className="text-lime-700">in {selectedDept}</span> : ''}
          </h2>
        </div>
        <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-3">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="control-input w-full sm:w-auto px-4 py-2 font-medium"
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          <div className="flex bg-slate-100 rounded-2xl p-1 border border-slate-200">
            <button onClick={() => setDensity('comfortable')} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${!isCompact ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>Comfort</button>
            <button onClick={() => setDensity('compact')} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${isCompact ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>Compact</button>
          </div>
        </div>
      </div>

      <section className={`surface-card overflow-hidden ${bulkLocationMode ? 'ring-2 ring-lime-200/80' : ''}`}>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Bulk Location Mode</p>
            <h3 className="mt-1 flex items-center gap-2 text-xl font-semibold text-slate-950">
              <LocateFixed className="h-5 w-5 text-lime-600" />
              Set one location, then scan bottles
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Enter a shelf code like A1, turn on the mode, then scan UPCs. Items with no location save automatically; items with existing locations ask whether to replace one location or add the new one.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setBulkLocationMode(!bulkLocationMode);
              setBulkCandidates([]);
              setBulkDecision(null);
              setBulkMessage(null);
              setSearchQuery('');
            }}
            className={bulkLocationMode ? 'btn-secondary px-5 py-2.5 text-sm' : 'btn-accent px-5 py-2.5 text-sm'}
          >
            {bulkLocationMode ? 'Stop Bulk Mode' : 'Start Bulk Mode'}
          </button>
        </div>

        <div className="border-t border-slate-200 bg-slate-50/70 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(180px,260px)_1fr] lg:items-end">
            <label className="block">
              <span className="field-label">Active location</span>
              <input
                value={activeLocation}
                onChange={event => setActiveLocation(normalizeLocation(event.target.value))}
                className="control-input mt-1 w-full px-3 py-3 text-base font-semibold"
                placeholder="A1"
              />
            </label>
            <div className={`rounded-2xl border px-4 py-3 text-sm ${bulkLocationMode && activeLocation.trim() ? 'border-lime-200 bg-lime-50 text-lime-800' : 'border-slate-200 bg-white text-slate-500'}`}>
              <div className="flex items-start gap-3">
                <ScanLine className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  {bulkLocationMode
                    ? activeLocation.trim()
                      ? `Ready. Scan UPCs to save location ${normalizeLocation(activeLocation)}.`
                      : 'Enter a location before scanning.'
                    : 'Start Bulk Mode when you are ready to scan items into this location.'}
                </p>
              </div>
            </div>
          </div>

          {bulkMessage && (
            <div className={`mt-4 flex items-center gap-2 rounded-2xl border p-4 text-sm font-medium ${bulkMessage.type === 'success' ? 'border-lime-200 bg-lime-50 text-lime-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {bulkMessage.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              <span>{bulkMessage.text}</span>
            </div>
          )}

        </div>
      </section>

      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${isCompact ? 'gap-3' : 'gap-6'}`}>
      {products.slice(0, visibleCount).map((product) => (
        <div key={product.sku} className={`surface-card overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all flex flex-col ${isCompact ? 'text-[13px]' : ''}`}>
          {/* Product Image Area */}
          <div className={`${isCompact ? 'h-36' : 'h-48'} bg-slate-50 relative border-b border-slate-200 flex items-center justify-center overflow-hidden`}>
            {product.image_url ? (
              <img src={proxyUrl(product.image_url)} alt={product.name} className="w-full h-full object-contain p-4" />
            ) : (
              <div className="text-slate-400 flex flex-col items-center">
                <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                <span className="text-sm font-medium">No Image</span>
              </div>
            )}
            
            {/* Location Badge */}
            <div className="absolute top-3 right-3">
              {product.location ? (
                <div className="badge-location max-w-[14rem]" title={`Rack ${product.location}`}>
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="truncate">Rack {product.location}</span>
                </div>
              ) : (
                <div className="badge-warning">
                  <MapPin className="w-3 h-3" />
                  No Location
                </div>
              )}
            </div>
          </div>

          {/* Product Info */}
          <div className={`${isCompact ? 'p-3' : 'p-5'} flex-1 flex flex-col`}>
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-lg leading-tight text-slate-950 line-clamp-2" title={product.name}>
                {product.name}
              </h3>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
              <span className="bg-slate-100 px-2 py-0.5 rounded-lg font-mono text-xs border border-slate-200">SKU: {product.sku}</span>
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

            <div className={`mt-auto grid grid-cols-2 ${isCompact ? 'gap-2 mb-3' : 'gap-4 mb-4'}`}>
              <div className={`bg-slate-50 ${isCompact ? 'p-2' : 'p-3'} rounded-2xl border border-slate-100`}>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Stock</div>
                <div className={`text-xl font-semibold ${(product.stock || 0) <= 5 ? 'text-red-600' : 'text-lime-700'}`}>
                  {product.stock ?? 0}
                </div>
              </div>
              <div className={`bg-slate-50 ${isCompact ? 'p-2' : 'p-3'} rounded-2xl border border-slate-100`}>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Price</div>
                <div className="text-xl font-semibold text-slate-950">
                  ${Number(product.price || 0).toFixed(2)}
                </div>
              </div>
            </div>

            {product.mainupc && (
              <div className={`flex justify-center ${isCompact ? 'mb-2 p-1.5' : 'mb-4 p-2'} bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden flex-col items-center`}>
                <div className={`flex flex-col items-center ${isCompact ? 'scale-[0.68]' : 'scale-75'} origin-center`}>
                  <Barcode value={product.mainupc} format="CODE128" width={1.5} height={40} fontSize={12} background="transparent" />
                </div>
                {product.alt_upcs && (
                  <div className="text-xs text-slate-400 mt-1 max-w-full truncate text-center" title={`Alt UPCs: ${product.alt_upcs}`}>
                    + {product.alt_upcs.split(',').length} Alt UPCs
                  </div>
                )}
              </div>
            )}

            {/* Edit Section */}
            {editingSku === product.sku ? (
              <div className="edit-panel space-y-4">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Edit product details</p>
                    <p className="field-help mt-0.5">Update shelf placement, image URL, and alternate UPCs.</p>
                  </div>
                  <span className="status-chip border-slate-200 bg-white text-slate-500">SKU {product.sku}</span>
                </div>
                <div>
                  <label className="field-label mb-1.5">Rack Location</label>
                  <input 
                    type="text" 
                    value={editLocation} 
                    onChange={e => setEditLocation(e.target.value.toUpperCase())}
                    className="control-input w-full px-3 py-2.5 text-sm"
                    placeholder="e.g. 4B"
                  />
                  <p className="field-help mt-1.5">Use short shelf codes like A4, B12, or comma-separated locations like A1, B6.</p>
                </div>
                <div>
                  <label className="field-label mb-1.5">Image URL</label>
                  <input 
                    type="text" 
                    value={editImageUrl} 
                    onChange={e => setEditImageUrl(e.target.value)}
                    className="control-input w-full px-3 py-2.5 text-sm"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="field-label mb-1.5">Alternate UPCs</label>
                  <input 
                    type="text" 
                    value={editAltUpcs} 
                    onChange={e => setEditAltUpcs(e.target.value)}
                    className="control-input w-full px-3 py-2.5 text-sm font-mono"
                    placeholder="1234, 5678"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => saveEdits(product.sku)} className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm">
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                  <button onClick={cancelEditing} className="btn-secondary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm">
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 mt-2">
                <button 
                  onClick={() => startEditing(product)}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2 py-2 text-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button 
                  onClick={() => openImageSelector(product.sku)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold text-slate-950 bg-lime-100 hover:bg-lime-200 border border-lime-200 rounded-2xl transition-colors"
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
        <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-500">
          <Package className="w-16 h-16 mb-4 opacity-20" />
          <h2 className="text-xl font-medium text-slate-700 mb-2">No products found</h2>
          <p>Upload your inventory CSV to get started, or try a different search.</p>
        </div>
      )}
    </div>
    </div>
  );
};
