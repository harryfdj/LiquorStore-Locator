import React, { useState, useEffect } from 'react';
import { Settings, X, Save, AlertCircle } from 'lucide-react';

interface CsvMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: any;
  token: string;
  onSuccess: (updatedStore: any) => void;
}

export const CsvMappingModal: React.FC<CsvMappingModalProps> = ({ isOpen, onClose, store, token, onSuccess }) => {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (store && store.csv_mapping) {
      setMapping(store.csv_mapping);
    } else {
      setMapping({});
    }
    setError('');
  }, [store]);

  if (!isOpen || !store) return null;

  const fields = [
    { key: 'sku', label: 'SKU / Item Number' },
    { key: 'mainupc', label: 'UPC / Barcode' },
    { key: 'name', label: 'Item Name / Description' },
    { key: 'price', label: 'Retail Price' },
    { key: 'cost', label: 'Wholesale Cost' },
    { key: 'stock', label: 'Quantity / Stock Level' },
    { key: 'size', label: 'Size (Optional)' },
    { key: 'pack', label: 'Pack (Optional)' },
    { key: 'category', label: 'Category (Optional)' },
    { key: 'depname', label: 'Department (Optional)' }
  ];

  const handleSave = async () => {
    setLoading(true);
    setError('');
    
    // Clean empty mappings mapping
    const cleanedMapping: Record<string, string> = {};
    for (const [k, val] of Object.entries(mapping)) {
      const v = val as string;
      if (v && v.trim()) cleanedMapping[k] = v.trim();
    }

    try {
      const res = await fetch(`/api/admin/stores/${store.id}/mapping`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ mapping: cleanedMapping })
      });
      
      if (res.ok) {
        onSuccess({ ...store, csv_mapping: cleanedMapping });
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save mapping');
      }
    } catch (e) {
      setError('Network error saving mapping');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-stone-200 flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-stone-800 text-lg">CSV Headers for {store.name}</h2>
              <p className="text-xs text-stone-500">Provide the exact column names used in this store's CSVs.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-lg text-stone-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto bg-white flex-1 relative">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium flex gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {fields.map(f => (
              <div key={f.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <label className="text-sm font-bold text-stone-700 sm:w-1/2">{f.label}</label>
                <input 
                  type="text" 
                  value={mapping[f.key] || ''}
                  onChange={e => setMapping({...mapping, [f.key]: e.target.value})}
                  className="flex-1 bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  placeholder="e.g. ItemDesc"
                />
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-stone-500 bg-stone-50 p-4 rounded-xl border border-stone-200">
            <strong>Note:</strong> Leave a field blank to use our built-in defaults (e.g., "description" or "ITEMNAME" for Item Name).
          </p>
        </div>

        <div className="p-5 border-t border-stone-200 bg-stone-50 flex gap-3 justify-end shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 font-semibold text-stone-600 hover:bg-stone-200 bg-stone-100 rounded-xl transition-colors text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition-colors text-sm"
          >
            {loading ? 'Saving...' : <><Save className="w-4 h-4" /> Save Mappings</>}
          </button>
        </div>
      </div>
    </div>
  );
};
