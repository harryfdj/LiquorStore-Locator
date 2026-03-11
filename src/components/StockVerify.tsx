import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Check, X, AlertCircle } from 'lucide-react';
import { Product } from '../types';
import { CameraScanner } from './CameraScanner';

interface StockVerifyProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export function StockVerify({ searchQuery, setSearchQuery }: StockVerifyProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState('');
  const [actualStock, setActualStock] = useState<number | ''>('');
  const [isMismatched, setIsMismatched] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const fetchProductByUpc = async (searchUpc: string) => {
    if (!searchUpc.trim()) {
      setProduct(null);
      setError('');
      return;
    }

    setError('');
    setProduct(null);
    setIsMismatched(false);
    setActualStock('');
    setSuccessMessage('');

    try {
      const res = await fetch(`/api/products/upc/${encodeURIComponent(searchUpc.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setProduct(data);
      } else {
        setError('Product not found in system.');
      }
    } catch (err) {
      setError('Failed to fetch product.');
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery) {
        fetchProductByUpc(searchQuery);
      } else {
        setProduct(null);
        setError('');
      }
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const submitVerification = async (status: 'matched' | 'mismatched', stock: number) => {
    if (!product) return;

    try {
      const res = await fetch('/api/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: product.sku,
          mainupc: product.mainupc,
          name: product.name,
          system_stock: product.stock ?? 0,
          actual_stock: stock,
          status
        })
      });

      if (res.ok) {
        setSuccessMessage(`Verified: ${product.name}`);
        setProduct(null);
        setSearchQuery('');
        setIsMismatched(false);
        setActualStock('');
      } else {
        setError('Failed to save verification.');
      }
    } catch (err) {
      setError('Failed to save verification.');
    }
  };

  const handleMatch = () => {
    if (product) submitVerification('matched', product.stock ?? 0);
  };

  const handleMismatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (product && actualStock !== '') {
      submitVerification('mismatched', Number(actualStock));
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 mb-6">
        <h2 className="text-xl font-bold text-stone-800 mb-2">Stock Verify Mode</h2>
        <p className="text-stone-500">Scan an item's UPC or search using the top bar to verify its stock level.</p>
        
        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}
        
        {successMessage && !product && (
          <div className="mt-4 p-4 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2">
            <Check className="w-5 h-5" />
            {successMessage}
          </div>
        )}
      </div>

      {product && (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="p-6">
            <div className="flex gap-6">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-32 h-32 object-contain rounded-lg bg-stone-50 border border-stone-100 p-2" />
              ) : (
                <div className="w-32 h-32 bg-stone-50 rounded-lg border border-stone-100 flex items-center justify-center">
                  <span className="text-stone-400 text-sm">No Image</span>
                </div>
              )}
              
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-stone-800 mb-2">{product.name}</h3>
                <div className="text-stone-500 space-y-1 mb-4">
                  <p>UPC: <span className="font-mono text-stone-700">{product.mainupc || 'N/A'}</span></p>
                  <p>SKU: <span className="font-mono text-stone-700">{product.sku}</span></p>
                  <p>Location: <span className="font-medium text-stone-700">{product.location || 'None'}</span></p>
                </div>
                
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 inline-block">
                  <p className="text-sm text-stone-500 uppercase tracking-wider font-medium mb-1">System Stock</p>
                  <p className="text-4xl font-bold text-stone-800">{product.stock ?? 0}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-stone-100 pt-6">
              {!isMismatched ? (
                <div>
                  <p className="text-center text-stone-600 mb-4 font-medium text-lg">Does the rack have exactly {product.stock ?? 0} items?</p>
                  <div className="flex gap-4">
                    <button onClick={handleMatch} className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                      <Check className="w-6 h-6" /> Yes, Match
                    </button>
                    <button onClick={() => setIsMismatched(true)} className="flex-1 bg-red-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                      <X className="w-6 h-6" /> No, Mismatch
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleMismatchSubmit} className="bg-red-50 p-6 rounded-xl border border-red-100">
                  <h4 className="text-red-800 font-bold text-lg mb-4">Enter Actual Stock</h4>
                  <div className="flex gap-4">
                    <input
                      type="number"
                      value={actualStock}
                      onChange={(e) => setActualStock(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Actual quantity..."
                      className="flex-1 px-4 py-3 border border-red-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-lg"
                      required
                      min="0"
                      autoFocus
                    />
                    <button type="submit" className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-700 transition-colors">
                      Save Update
                    </button>
                    <button type="button" onClick={() => setIsMismatched(false)} className="bg-stone-200 text-stone-700 px-6 py-3 rounded-xl font-bold hover:bg-stone-300 transition-colors">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
