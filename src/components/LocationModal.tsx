import React, { useState, useEffect } from 'react';
import { MapPin, X, Save, AlertCircle } from 'lucide-react';
import { apiJson } from '../lib/api';
import { StoreSummary } from '../types';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: StoreSummary | null;
  onSuccess: (updatedStore: StoreSummary) => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({ isOpen, onClose, store, onSuccess }) => {
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  const [radiusMiles, setRadiusMiles] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (store) {
      setLat(store.lat != null ? String(store.lat) : '');
      setLng(store.lng != null ? String(store.lng) : '');
      setRadiusMiles(store.radius_miles != null ? String(store.radius_miles) : '');
    } else {
      setLat('');
      setLng('');
      setRadiusMiles('');
    }
    setError('');
  }, [store]);

  if (!isOpen || !store) return null;

  const handleSave = async () => {
    setLoading(true);
    setError('');
    
    const parsedLat = lat ? parseFloat(lat) : null;
    const parsedLng = lng ? parseFloat(lng) : null;
    const parsedRadius = radiusMiles ? parseFloat(radiusMiles) : null;

    if ((parsedLat && isNaN(parsedLat)) || (parsedLng && isNaN(parsedLng)) || (parsedRadius && isNaN(parsedRadius))) {
      setError('Please enter valid numerical values.');
      setLoading(false);
      return;
    }

    try {
      const updatedStore = await apiJson<StoreSummary>(`/api/admin/stores/${store.id}/location`, {
        method: 'PUT',
        body: JSON.stringify({ lat: parsedLat, lng: parsedLng, radius_miles: parsedRadius })
      });

      onSuccess(updatedStore);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error saving location');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-stone-200 flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-stone-800 text-lg">GeoFence Limits</h2>
              <p className="text-xs text-stone-500">Enable location lock for {store.name}</p>
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
            <div>
              <label className="text-sm font-bold text-stone-700 block mb-1">Latitude</label>
              <input 
                type="number" 
                step="any"
                value={lat}
                onChange={e => setLat(e.target.value)}
                className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="e.g. 40.7128"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-stone-700 block mb-1">Longitude</label>
              <input 
                type="number" 
                step="any"
                value={lng}
                onChange={e => setLng(e.target.value)}
                className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="e.g. -74.0060"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-stone-700 block mb-1">Allowed Radius (Miles)</label>
              <input 
                type="number" 
                step="any"
                value={radiusMiles}
                onChange={e => setRadiusMiles(e.target.value)}
                className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="e.g. 0.5"
              />
            </div>
          </div>
          <p className="mt-6 text-sm text-stone-500 bg-stone-50 p-4 rounded-xl border border-stone-200">
            <strong>Note:</strong> Leave all fields completely blank to permanently disable the Geofence tracker for this specific store.
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
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition-colors text-sm"
          >
            {loading ? 'Saving...' : <><Save className="w-4 h-4" /> Save Security Boundaries</>}
          </button>
        </div>
      </div>
    </div>
  );
};
