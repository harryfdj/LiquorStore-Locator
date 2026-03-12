import React, { useState, useEffect } from 'react';
import { FileText, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';
import Barcode from 'react-barcode';
import { Verification } from '../types';

export function VerificationReports() {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [filter, setFilter] = useState<'all' | 'matched' | 'mismatched'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchVerifications = async () => {
    try {
      const res = await fetch('/api/verifications');
      if (res.ok) {
        const data = await res.json();
        setVerifications(data);
      } else {
        setError('Failed to fetch verifications.');
      }
    } catch (err) {
      setError('Failed to fetch verifications.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifications();
  }, []);

  const handleClear = async () => {
    if (!window.confirm('Are you sure you want to clear all verification history? This cannot be undone.')) return;
    
    try {
      const res = await fetch('/api/verifications', { method: 'DELETE' });
      if (res.ok) {
        setVerifications([]);
      } else {
        setError('Failed to clear verifications.');
      }
    } catch (err) {
      setError('Failed to clear verifications.');
    }
  };

  if (isLoading) return <div className="text-center py-12 text-stone-500">Loading reports...</div>;

  const mismatches = verifications.filter(v => v.status === 'mismatched');
  const matches = verifications.filter(v => v.status === 'matched');

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Verification Report</h2>
          <p className="text-stone-500">Review your weekly stock verification results.</p>
        </div>
        <button 
          onClick={handleClear}
          className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-100 transition-colors border border-red-200"
        >
          <Trash2 className="w-4 h-4" />
          Clear History
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div 
          onClick={() => setFilter('all')}
          className={`cursor-pointer bg-white p-6 rounded-2xl shadow-sm border transition-all ${filter === 'all' ? 'border-stone-800 ring-2 ring-stone-800 ring-offset-2' : 'border-stone-200 hover:border-stone-300'}`}
        >
          <div className="text-stone-500 text-sm font-medium uppercase tracking-wider mb-2">Total Verified</div>
          <div className="text-4xl font-bold text-stone-800">{verifications.length}</div>
        </div>
        <div 
          onClick={() => setFilter('matched')}
          className={`cursor-pointer bg-emerald-50 p-6 rounded-2xl shadow-sm border transition-all ${filter === 'matched' ? 'border-emerald-500 ring-2 ring-emerald-500 ring-offset-2' : 'border-emerald-100 hover:border-emerald-200'}`}
        >
          <div className="text-emerald-600 text-sm font-medium uppercase tracking-wider mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Matched
          </div>
          <div className="text-4xl font-bold text-emerald-700">{matches.length}</div>
        </div>
        <div 
          onClick={() => setFilter('mismatched')}
          className={`cursor-pointer bg-red-50 p-6 rounded-2xl shadow-sm border transition-all ${filter === 'mismatched' ? 'border-red-500 ring-2 ring-red-500 ring-offset-2' : 'border-red-100 hover:border-red-200'}`}
        >
          <div className="text-red-600 text-sm font-medium uppercase tracking-wider mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Mismatched
          </div>
          <div className="text-4xl font-bold text-red-700">{mismatches.length}</div>
        </div>
      </div>

      {(filter === 'all' || filter === 'mismatched') && (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden mb-8">
          <div className="p-6 border-b border-stone-100 bg-stone-50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Discrepancies (Mismatched Stock)
            </h3>
          </div>
          
          {mismatches.length === 0 ? (
            <div className="p-12 text-center text-stone-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
              <p className="text-lg font-medium">No discrepancies found!</p>
              <p>All verified items match the system stock.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider">Date</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider">Product</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-center">Barcode / UPC</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">System Stock</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">Actual Stock</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {mismatches.map((v) => {
                    const diff = v.actual_stock - v.system_stock;
                    return (
                      <tr key={v.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                        <td className="p-4 text-sm text-stone-500 whitespace-nowrap">
                          {new Date(v.created_at).toLocaleString()}
                        </td>
                        <td className="p-4 font-medium text-stone-800">{v.name}</td>
                        <td className="p-4 flex flex-col items-center justify-center">
                          {v.mainupc ? (
                            <div className="overflow-hidden mix-blend-multiply opacity-80 scale-90 origin-center">
                              <Barcode value={v.mainupc} format="CODE128" width={1.5} height={30} fontSize={12} background="transparent" />
                            </div>
                          ) : (
                            <span className="text-sm text-stone-400">No Barcode</span>
                          )}
                          <span className="text-xs text-stone-400 mt-1">{v.sku}</span>
                        </td>
                        <td className="p-4 text-right font-medium text-stone-600">{v.system_stock}</td>
                        <td className="p-4 text-right font-bold text-red-600">{v.actual_stock}</td>
                        <td className="p-4 text-right font-bold">
                          <span className={`px-2 py-1 rounded-md text-xs ${diff > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {diff > 0 ? '+' : ''}{diff}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(filter === 'all' || filter === 'matched') && (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="p-6 border-b border-stone-100 bg-stone-50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              Verified (Matched Stock)
            </h3>
          </div>
          
          {matches.length === 0 ? (
            <div className="p-12 text-center text-stone-500">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-stone-300" />
              <p className="text-lg font-medium">No verified matches yet.</p>
              <p>Scan items to see them listed here when their stock matches perfectly.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider">Date</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider">Product</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-center">Barcode / UPC</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">System Stock</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">Actual Stock</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((v) => {
                    return (
                      <tr key={v.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                        <td className="p-4 text-sm text-stone-500 whitespace-nowrap">
                          {new Date(v.created_at).toLocaleString()}
                        </td>
                        <td className="p-4 font-medium text-stone-800">{v.name}</td>
                        <td className="p-4 flex flex-col items-center justify-center">
                          {v.mainupc ? (
                            <div className="overflow-hidden mix-blend-multiply opacity-80 scale-90 origin-center">
                              <Barcode value={v.mainupc} format="CODE128" width={1.5} height={30} fontSize={12} background="transparent" />
                            </div>
                          ) : (
                            <span className="text-sm text-stone-400">No Barcode</span>
                          )}
                          <span className="text-xs text-stone-400 mt-1">{v.sku}</span>
                        </td>
                        <td className="p-4 text-right font-medium text-stone-600">{v.system_stock}</td>
                        <td className="p-4 text-right font-bold text-emerald-600">{v.actual_stock}</td>
                        <td className="p-4 text-right font-bold">
                          <span className="px-2 py-1 rounded-md text-xs bg-emerald-100 text-emerald-700">Perfect</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
