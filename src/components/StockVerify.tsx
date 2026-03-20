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
  const [isOverriding, setIsOverriding] = useState(false);

  const fetchProductByUpc = async (searchUpc: string) => {
    if (!searchUpc.trim()) {
      setProduct(null);
      setError('');
      return;
    }

    setError('');
    setProduct(null);
    setIsMismatched(false);
    setIsOverriding(false);
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
      const stockNum = Number(actualStock);
      const systemStock = product.stock ?? 0;
      
      if (stockNum === systemStock) {
        submitVerification('matched', stockNum);
      } else {
        submitVerification('mismatched', stockNum);
      }
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
                <div className="text-stone-500 space-y-1 mb-6">
                  <div className="flex flex-wrap gap-4 mb-3">
                    <p className="text-lg text-stone-600 bg-emerald-50 text-emerald-800 px-3 py-1 rounded-lg border border-emerald-100">
                      Retail: <span className="font-bold">${product.price != null ? product.price.toFixed(2) : '0.00'}</span>
                    </p>
                    <p className="text-lg text-stone-600 bg-sky-50 text-sky-800 px-3 py-1 rounded-lg border border-sky-100">
                      Cost: <span className="font-bold">${product.cost != null ? product.cost.toFixed(2) : '0.00'}</span>
                    </p>
                  </div>
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
              {product.existing_verification && !isOverriding ? (
                <div className="bg-amber-50 rounded-xl p-6 border border-amber-200">
                  <div className="flex items-center gap-3 mb-4 text-amber-800">
                    <AlertCircle className="w-6 h-6" />
                    <h4 className="font-bold text-lg">Already Scanned</h4>
                  </div>
                  <p className="text-amber-800 mb-6">
                    This item was already verified as <strong className="uppercase">{product.existing_verification.status}</strong> 
                    {product.existing_verification.status === 'mismatched' && <span> with an actual stock of <strong>{product.existing_verification.actual_stock}</strong> (System had: {product.stock ?? 0})</span>}.
                  </p>
                  <button 
                    onClick={() => {
                      setIsOverriding(true);
                      if (product.existing_verification?.status === 'mismatched') {
                         setIsMismatched(true);
                         setActualStock(product.existing_verification.actual_stock);
                      }
                    }} 
                    className="w-full bg-amber-600 text-white py-3 justify-center rounded-xl font-bold flex items-center gap-2 hover:bg-amber-700 transition"
                  >
                    Change Verification?
                  </button>
                </div>
              ) : !isMismatched ? (
                <div>
                  <p className="text-center text-stone-600 mb-4 font-medium text-lg">Does the rack have exactly {product.stock ?? 0} items?</p>
                  <div className="flex gap-4">
                    <button onClick={handleMatch} className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-sm hover:shadow">
                      <Check className="w-6 h-6" /> Yes, Match
                    </button>
                    <button onClick={() => setIsMismatched(true)} className="flex-1 bg-red-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-sm hover:shadow">
                      <X className="w-6 h-6" /> No, Mismatch
                    </button>
                  </div>
                  {product.existing_verification && isOverriding && (
                    <button onClick={() => setIsOverriding(false)} className="w-full mt-4 text-stone-500 hover:text-stone-800 font-medium py-2">
                      Cancel Override
                    </button>
                  )}
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
                      className="flex-1 px-4 py-3 border border-red-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-lg shadow-inner"
                      required
                      min="0"
                      autoFocus
                    />
                    <button type="submit" className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-sm">
                      Save Update
                    </button>
                    <button type="button" onClick={() => {
                      setIsMismatched(false);
                      if (product.existing_verification) setIsOverriding(false);
                    }} className="bg-white border border-stone-200 text-stone-700 px-6 py-3 rounded-xl font-bold hover:bg-stone-50 transition-colors shadow-sm">
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
