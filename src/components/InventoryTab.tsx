import React from 'react';
import { Package, MapPin, Image as ImageIcon, Edit2, Search } from 'lucide-react';
import Barcode from 'react-barcode';
import { Product } from '../types';

export const proxyUrl = (url: string) => {
  if (!url) return '';
  if (url.match(/^\/product-images(?:-\d+)?\//)) return url;
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
};

interface InventoryTabProps {
  products: Product[];
  visibleCount: number;
  editingSku: string | null;
  editLocation: string;
  setEditLocation: (v: string) => void;
  editImageUrl: string;
  setEditImageUrl: (v: string) => void;
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
  editImageUrl, setEditImageUrl, startEditing, cancelEditing, saveEdits,
  openImageSelector, selectedDept, setSelectedDept, departments
}) => {
  return (
    <div className="flex flex-col gap-6">
      {/* Department Filter Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-stone-200">
        <h2 className="text-lg sm:text-lg font-bold text-stone-800">
          Showing {products.length} Items {selectedDept ? <span className="text-emerald-600">in {selectedDept}</span> : ''}
        </h2>
        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="bg-stone-50 border border-stone-300 text-stone-700 font-medium rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm w-full sm:w-auto transition-colors hover:border-emerald-400 cursor-pointer"
        >
          <option value="">All Departments</option>
          {departments.map(dept => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.slice(0, visibleCount).map((product) => (
        <div key={product.sku} className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
          {/* Product Image Area */}
          <div className="h-48 bg-stone-100 relative border-b border-stone-200 flex items-center justify-center overflow-hidden">
            {product.image_url ? (
              <img src={proxyUrl(product.image_url)} alt={product.name} className="w-full h-full object-contain p-4" />
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
    </div>
  );
};
