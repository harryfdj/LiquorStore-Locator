import React, { useState, useEffect } from 'react';
import { FileText, AlertTriangle, CheckCircle, Trash2, Archive, CalendarDays, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';
import Barcode from 'react-barcode';
import { Verification, WeeklyReport } from '../types';
import { apiFetch, apiJson } from '../lib/api';
import { proxyUrl } from './InventoryTab';

export function VerificationReports() {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [pastReports, setPastReports] = useState<WeeklyReport[]>([]);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Verification[]>([]);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'matched' | 'mismatched'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchVerifications = async () => {
    try {
      setVerifications(await apiJson<Verification[]>('/api/verifications'));
    } catch (err) {
      setError('Failed to fetch verifications.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPastReports = async () => {
    try {
      setPastReports(await apiJson<WeeklyReport[]>('/api/reports'));
    } catch (err) {
      console.error('Failed to fetch past reports', err);
    }
  };

  const handleExpandReport = async (reportId: string) => {
    if (expandedReportId === reportId) {
      setExpandedReportId(null);
      setExpandedItems([]);
      return;
    }
    
    setExpandedReportId(reportId);
    setExpandedLoading(true);
    try {
      setExpandedItems(await apiJson<Verification[]>(`/api/reports/${reportId}/items`));
    } catch (err) {
      console.error('Failed to fetch report items', err);
    } finally {
      setExpandedLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifications();
    fetchPastReports();
  }, []);

  const handleFinalizeReport = async () => {
    if (verifications.length === 0) {
      alert("There are no items verified this week to report.");
      return;
    }
    if (!window.confirm('Are you sure you want to finalize this week\'s report? This will save your current progress to the Past Reports and clear the list for next week. This action cannot be undone.')) return;
    
    try {
      await apiFetch('/api/reports/finalize', { method: 'POST' });
      setVerifications([]);
      fetchPastReports(); // Refresh past reports
    } catch (err) {
      setError('Failed to finalize report.');
    }
  };

  if (isLoading) return <div className="text-center py-12 text-stone-500">Loading reports...</div>;

  const mismatches = verifications.filter(v => v.status === 'mismatched');
  const matches = verifications.filter(v => v.status === 'matched');

  const totalValueCost = verifications.reduce((sum, v) => sum + (v.actual_stock * (v.cost || 0)), 0);
  const totalValueRetail = verifications.reduce((sum, v) => sum + (v.actual_stock * (v.price || 0)), 0);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Verification Report</h2>
          <p className="text-stone-500">Review your weekly stock verification results.</p>
        </div>
        <button 
          onClick={handleFinalizeReport}
          disabled={verifications.length === 0}
          className="flex items-center gap-2 bg-stone-800 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-stone-900 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Archive className="w-4 h-4" />
          Mark as Reported
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-sky-50 p-6 rounded-2xl shadow-sm border border-sky-100">
          <div className="text-sky-600 text-sm font-medium uppercase tracking-wider mb-2">Total Verified Cost</div>
          <div className="text-4xl font-bold text-sky-700">${totalValueCost.toFixed(2)}</div>
        </div>
        <div className="bg-blue-50 p-6 rounded-2xl shadow-sm border border-blue-100">
          <div className="text-blue-600 text-sm font-medium uppercase tracking-wider mb-2">Total Verified Retail Value</div>
          <div className="text-4xl font-bold text-blue-700">${totalValueRetail.toFixed(2)}</div>
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
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider">Date</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider">Product</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-center">Barcode / UPC</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">System Stock</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">Actual Stock</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">Unit Cost</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">Total Value</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {mismatches.map((v) => {
                    const diff = v.actual_stock - v.system_stock;
                    return (
                      <tr key={v.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                        <td className="p-4 text-sm text-stone-500 whitespace-nowrap align-middle">
                          {new Date(v.created_at).toLocaleDateString()},<br/>
                          <span className="block mt-1">{new Date(v.created_at).toLocaleTimeString()}</span>
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-16 bg-white rounded-lg border border-stone-200 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                              {v.image_url ? (
                                <img src={proxyUrl(v.image_url)} alt={v.name} className="w-full h-full object-contain mix-blend-multiply" loading="lazy" />
                              ) : (
                                <FileText className="w-6 h-6 text-stone-300" />
                              )}
                            </div>
                            <span className="font-bold text-stone-800 leading-tight">{v.name}</span>
                          </div>
                        </td>
                        <td className="p-4 flex flex-col items-center justify-center align-middle">
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
                        <td className="p-4 text-right font-medium text-stone-600">${v.cost?.toFixed(2) || '0.00'}</td>
                        <td className="p-4 text-right font-bold text-sky-700">${(v.actual_stock * (v.cost || 0)).toFixed(2)}</td>
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
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider">Date</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider">Product</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-center">Barcode / UPC</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">System Stock</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">Actual Stock</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">Unit Cost</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">Total Value</th>
                    <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((v) => {
                    return (
                      <tr key={v.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                        <td className="p-4 text-sm text-stone-500 whitespace-nowrap align-middle">
                          {new Date(v.created_at).toLocaleDateString()},<br/>
                          <span className="block mt-1">{new Date(v.created_at).toLocaleTimeString()}</span>
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-16 bg-white rounded-lg border border-stone-200 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                              {v.image_url ? (
                                <img src={v.image_url} alt={v.name} className="w-full h-full object-contain mix-blend-multiply" loading="lazy" />
                              ) : (
                                <FileText className="w-6 h-6 text-stone-300" />
                              )}
                            </div>
                            <span className="font-bold text-stone-800 leading-tight">{v.name}</span>
                          </div>
                        </td>
                        <td className="p-4 flex flex-col items-center justify-center align-middle">
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
                        <td className="p-4 text-right font-medium text-stone-600">${v.cost?.toFixed(2) || '0.00'}</td>
                        <td className="p-4 text-right font-bold text-sky-700">${(v.actual_stock * (v.cost || 0)).toFixed(2)}</td>
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

      {/* PASt WEEKLY REPORTS */}
      <div className="mt-12 bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-6 border-b border-stone-100 bg-stone-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-stone-500" />
            Past Weekly Reports
          </h3>
        </div>

        {pastReports.length === 0 ? (
          <div className="p-12 text-center text-stone-500">
            <BarChart2 className="w-12 h-12 mx-auto mb-4 text-stone-300" />
            <p className="text-lg font-medium">No past reports yet.</p>
            <p className="text-sm">When you click "Mark as Reported", your weekly totals will be archived here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider">Report Date</th>
                  <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">Total Scanned</th>
                  <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">Cost Value</th>
                  <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">Retail Value</th>
                  <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">Matched</th>
                  <th className="p-4 font-medium text-stone-500 text-sm uppercase tracking-wider text-right">Mismatched</th>
                </tr>
              </thead>
              <tbody>
                {pastReports.map((report) => {
                  const isExpanded = expandedReportId === report.id;
                  return (
                    <React.Fragment key={report.id}>
                      <tr 
                        onClick={() => handleExpandReport(report.id)} 
                        className={`border-b border-stone-100 hover:bg-stone-50 transition-colors cursor-pointer ${isExpanded ? 'bg-stone-50' : ''}`}
                      >
                        <td className="p-4 font-medium text-stone-800 flex items-center gap-3">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                          <div>
                            {new Date(report.created_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            <span className="block text-xs font-normal text-stone-500 mt-1">{new Date(report.created_at).toLocaleTimeString()}</span>
                          </div>
                        </td>
                        <td className="p-4 text-right font-bold text-stone-700">{report.total_scanned} Items</td>
                        <td className="p-4 text-right font-bold text-sky-700">${report.total_value_cost != null ? report.total_value_cost.toFixed(2) : '0.00'}</td>
                        <td className="p-4 text-right font-bold text-blue-700">${report.total_value_retail != null ? report.total_value_retail.toFixed(2) : '0.00'}</td>
                        <td className="p-4 text-right font-bold text-emerald-600">
                          {report.total_matched} 
                          <span className="text-xs font-normal text-emerald-600/70 block">{report.total_scanned > 0 ? Math.round((report.total_matched/report.total_scanned)*100) : 0}% accuracy</span>
                        </td>
                        <td className="p-4 text-right font-bold text-red-600">
                          {report.total_mismatched}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-stone-50 p-0 border-b border-stone-200">
                            <div className="p-6 border-t border-stone-200 shadow-inner">
                              <h4 className="font-bold text-stone-800 mb-4">Report Details</h4>
                              {expandedLoading ? (
                                <div className="text-sm text-stone-500 py-4">Loading items...</div>
                              ) : expandedItems.length === 0 ? (
                                <div className="text-sm text-stone-500 py-4">No items recorded.</div>
                              ) : (
                                <div className="flex flex-col gap-6">
                                  {/* Mismatched Items Table */}
                                  {expandedItems.filter(i => i.status === 'mismatched').length > 0 && (
                                    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
                                      <div className="bg-red-50 border-b border-red-100 p-3 px-4 font-semibold text-red-700 text-sm flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" /> Mismatched Items
                                      </div>
                                      <table className="w-full text-left text-sm">
                                        <thead className="bg-stone-50 text-xs uppercase text-stone-500 font-medium">
                                          <tr>
                                            <th className="px-4 py-3">Date</th>
                                            <th className="px-4 py-3">Product</th>
                                            <th className="px-4 py-3 text-center">Barcode / UPC</th>
                                            <th className="px-4 py-3 text-right">System</th>
                                            <th className="px-4 py-3 text-right">Actual</th>
                                            <th className="px-4 py-3 text-right">Unit Cost</th>
                                            <th className="px-4 py-3 text-right">Total Value</th>
                                            <th className="px-4 py-3 text-right">Diff</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100">
                                          {expandedItems.filter(i => i.status === 'mismatched').map(item => {
                                            const diff = item.actual_stock - item.system_stock;
                                            return (
                                              <tr key={item.id} className="hover:bg-stone-50">
                                                <td className="px-4 py-3 text-stone-500 whitespace-nowrap align-middle">
                                                  {new Date(item.created_at).toLocaleDateString()}<br/>
                                                  <span className="block mt-1">{new Date(item.created_at).toLocaleTimeString()}</span>
                                                </td>
                                                <td className="px-4 py-3 align-middle">
                                                  <div className="flex items-center gap-3">
                                                    <div className="w-8 h-10 bg-white rounded border border-stone-200 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                                                      {item.image_url ? (
                                                        <img src={proxyUrl(item.image_url)} alt={item.name} className="w-full h-full object-contain mix-blend-multiply" loading="lazy" />
                                                      ) : (
                                                        <FileText className="w-4 h-4 text-stone-300" />
                                                      )}
                                                    </div>
                                                    <span className="font-semibold text-stone-800 leading-tight">{item.name}</span>
                                                  </div>
                                                </td>
                                                <td className="px-4 py-3 flex flex-col items-center justify-center align-middle">
                                                  {item.mainupc ? (
                                                    <div className="overflow-hidden mix-blend-multiply opacity-80 scale-75 origin-center -my-2">
                                                      <Barcode value={item.mainupc} format="CODE128" width={1.5} height={30} fontSize={12} background="transparent" />
                                                    </div>
                                                  ) : (
                                                    <span className="text-sm text-stone-400">No Barcode</span>
                                                  )}
                                                  <span className="text-xs text-stone-400 mt-1">{item.sku}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-stone-600 align-middle">{item.system_stock}</td>
                                                <td className="px-4 py-3 text-right font-bold text-red-600 align-middle">{item.actual_stock}</td>
                                                <td className="px-4 py-3 text-right text-stone-600 align-middle">${item.cost?.toFixed(2) || '0.00'}</td>
                                                <td className="px-4 py-3 text-right font-bold text-sky-700 align-middle">${(item.actual_stock * (item.cost || 0)).toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right font-bold align-middle">
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

                                  {/* Matched Items Table */}
                                  {expandedItems.filter(i => i.status === 'matched').length > 0 && (
                                    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
                                      <div className="bg-emerald-50 border-b border-emerald-100 p-3 px-4 font-semibold text-emerald-700 text-sm flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4" /> Matched Items
                                      </div>
                                      <table className="w-full text-left text-sm">
                                        <thead className="bg-stone-50 text-xs uppercase text-stone-500 font-medium">
                                          <tr>
                                            <th className="px-4 py-3">Date</th>
                                            <th className="px-4 py-3">Product</th>
                                            <th className="px-4 py-3 text-center">Barcode / UPC</th>
                                            <th className="px-4 py-3 text-right">System</th>
                                            <th className="px-4 py-3 text-right">Actual</th>
                                            <th className="px-4 py-3 text-right">Unit Cost</th>
                                            <th className="px-4 py-3 text-right">Total Value</th>
                                            <th className="px-4 py-3 text-right">Status</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100">
                                          {expandedItems.filter(i => i.status === 'matched').map(item => (
                                            <tr key={item.id} className="hover:bg-stone-50">
                                              <td className="px-4 py-3 text-stone-500 whitespace-nowrap align-middle">
                                                {new Date(item.created_at).toLocaleDateString()}<br/>
                                                <span className="block mt-1">{new Date(item.created_at).toLocaleTimeString()}</span>
                                              </td>
                                              <td className="px-4 py-3 align-middle">
                                                <div className="flex items-center gap-3">
                                                  <div className="w-8 h-10 bg-white rounded border border-stone-200 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                                                    {item.image_url ? (
                                                      <img src={proxyUrl(item.image_url)} alt={item.name} className="w-full h-full object-contain mix-blend-multiply" loading="lazy" />
                                                    ) : (
                                                      <FileText className="w-4 h-4 text-stone-300" />
                                                    )}
                                                  </div>
                                                  <span className="font-semibold text-stone-800 leading-tight">{item.name}</span>
                                                </div>
                                              </td>
                                              <td className="px-4 py-3 flex flex-col items-center justify-center align-middle">
                                                {item.mainupc ? (
                                                  <div className="overflow-hidden mix-blend-multiply opacity-80 scale-75 origin-center -my-2">
                                                    <Barcode value={item.mainupc} format="CODE128" width={1.5} height={30} fontSize={12} background="transparent" />
                                                  </div>
                                                ) : (
                                                  <span className="text-sm text-stone-400">No Barcode</span>
                                                )}
                                                <span className="text-xs text-stone-400 mt-1">{item.sku}</span>
                                              </td>
                                              <td className="px-4 py-3 text-right text-stone-600 align-middle">{item.system_stock}</td>
                                              <td className="px-4 py-3 text-right font-bold text-emerald-600 align-middle">{item.actual_stock}</td>
                                              <td className="px-4 py-3 text-right text-stone-600 align-middle">${item.cost?.toFixed(2) || '0.00'}</td>
                                              <td className="px-4 py-3 text-right font-bold text-sky-700 align-middle">${(item.actual_stock * (item.cost || 0)).toFixed(2)}</td>
                                              <td className="px-4 py-3 text-right font-bold align-middle">
                                                <span className="px-2 py-1 rounded-md text-xs bg-emerald-100 text-emerald-700">Perfect</span>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
