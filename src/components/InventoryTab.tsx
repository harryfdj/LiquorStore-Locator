import React, { useState } from 'react';
import { Package, MapPin, Image as ImageIcon, Edit2, Search, Save, X } from 'lucide-react';
import Barcode from 'react-barcode';
import { Product } from '../types';
import { proxyUrl } from '../lib/images';

interface InventoryTabProps {
  products: Product[];
  visibleCount: number;
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
  openImageSelector: (sku: string) => void;
  selectedDept: string;
  setSelectedDept: (d: string) => void;
  departments: string[];
}

export const InventoryTab: React.FC<InventoryTabProps> = ({
  products, visibleCount, editingSku, editLocation, setEditLocation,
  editImageUrl, setEditImageUrl, editAltUpcs, setEditAltUpcs, 
  startEditing, cancelEditing, saveEdits,
  openImageSelector, selectedDept, setSelectedDept, departments
}) => {
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const isCompact = density === 'compact';

  return (
    <div className="flex flex-col gap-6">
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
                <div className="badge-location">
                  <MapPin className="w-4 h-4" />
                  Rack {product.location}
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
                  <p className="field-help mt-1.5">Use short shelf codes like A4, B12, or Cooler 2.</p>
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
