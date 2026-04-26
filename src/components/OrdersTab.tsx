import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, ClipboardPaste, FileText, PackageSearch, Search, Truck } from 'lucide-react';
import { apiFetch, apiJson } from '../lib/api';
import { Product, SupplierOrderDetail, SupplierOrderLine, SupplierOrderSummary } from '../types';

type LineDraft = {
  received: string;
  finalRack: string;
  notes: string;
};

interface OrdersTabProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

function statusLabel(line: SupplierOrderLine) {
  switch (line.issue_type) {
    case 'matched': return 'Matched';
    case 'short_received': return 'Short received';
    case 'extra_received': return 'Extra received';
    case 'rack_mismatch': return 'Rack mismatch';
    case 'manual_review': return 'Manual match needed';
    default: return 'Pending';
  }
}

function statusClass(line: SupplierOrderLine) {
  if (line.issue_type === 'matched') return 'border-lime-200 bg-lime-50 text-lime-800';
  if (line.issue_type === 'pending') return 'border-slate-200 bg-slate-50 text-slate-600';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function expectedRack(line: SupplierOrderLine) {
  return (line.inventory_stock_snapshot || 0) + (line.ordered_bottles || 0);
}

export function OrdersTab({ searchQuery, setSearchQuery }: OrdersTabProps) {
  const [orders, setOrders] = useState<SupplierOrderSummary[]>([]);
  const [detail, setDetail] = useState<SupplierOrderDetail | null>(null);
  const [html, setHtml] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({});
  const [productSearch, setProductSearch] = useState<Record<string, string>>({});
  const [productResults, setProductResults] = useState<Record<string, Product[]>>({});

  const loadOrders = async () => {
    setOrders(await apiJson<SupplierOrderSummary[]>('/api/orders'));
  };

  const loadDetail = async (orderId: string) => {
    const nextDetail = await apiJson<SupplierOrderDetail>(`/api/orders/${orderId}`);
    setDetail(nextDetail);
  };

  useEffect(() => {
    loadOrders()
      .catch(error => setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load orders' }))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!detail) return;
    const nextDrafts: Record<string, LineDraft> = {};
    for (const line of detail.lines) {
      nextDrafts[line.id] = {
        received: String(line.received_bottles ?? line.ordered_bottles ?? 0),
        finalRack: String(line.final_rack_count ?? expectedRack(line)),
        notes: line.notes || '',
      };
    }
    setDrafts(nextDrafts);
  }, [detail?.order.id]);

  useEffect(() => {
    if (!detail || !searchQuery.trim()) return;
    const needle = searchQuery.trim();
    const match = detail.lines.find(line => [line.upc, line.product_upc, line.item_no, line.product_sku]
      .filter(Boolean)
      .some(value => value?.toLowerCase() === needle.toLowerCase()));

    if (match) {
      document.getElementById(`order-line-${match.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchQuery, detail]);

  const summary = useMemo(() => {
    if (!detail) return null;
    return {
      matched: detail.lines.filter(line => line.issue_type === 'matched').length,
      issues: detail.lines.filter(line => !['pending', 'matched'].includes(line.issue_type)).length,
      pending: detail.lines.filter(line => ['pending', 'manual_review'].includes(line.issue_type)).length,
    };
  }, [detail]);

  const importOrder = async () => {
    setIsImporting(true);
    setMessage(null);
    try {
      const imported = await apiJson<SupplierOrderDetail>('/api/orders/import-html', {
        method: 'POST',
        body: JSON.stringify({ html }),
      });
      setDetail(imported);
      setHtml('');
      await loadOrders();
      setMessage({ type: 'success', text: `Imported order ${imported.order.order_no} with ${imported.lines.length} lines.` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to import order' });
    } finally {
      setIsImporting(false);
    }
  };

  const searchProducts = async (lineId: string) => {
    const query = productSearch[lineId]?.trim();
    if (!query) return;
    const products = await apiJson<Product[]>(`/api/products?q=${encodeURIComponent(query)}`);
    setProductResults(prev => ({ ...prev, [lineId]: products.slice(0, 8) }));
  };

  const matchProduct = async (line: SupplierOrderLine, sku: string) => {
    if (!detail) return;
    const nextDetail = await apiJson<SupplierOrderDetail>(`/api/orders/${detail.order.id}/lines/${line.id}/match-product`, {
      method: 'PUT',
      body: JSON.stringify({ product_sku: sku }),
    });
    setDetail(nextDetail);
    await loadOrders();
  };

  const verifyLine = async (line: SupplierOrderLine, values?: Partial<LineDraft>) => {
    if (!detail) return;
    const draft = { ...drafts[line.id], ...values };
    const nextDetail = await apiJson<SupplierOrderDetail>(`/api/orders/${detail.order.id}/lines/${line.id}/verify`, {
      method: 'PUT',
      body: JSON.stringify({
        received_bottles: draft.received,
        final_rack_count: draft.finalRack,
        notes: draft.notes,
      }),
    });
    setDetail(nextDetail);
    await loadOrders();
  };

  const finalizeOrder = async () => {
    if (!detail) return;
    try {
      const nextDetail = await apiJson<SupplierOrderDetail>(`/api/orders/${detail.order.id}/finalize`, { method: 'POST' });
      setDetail(nextDetail);
      await loadOrders();
      setMessage({ type: 'success', text: `Finalized order ${nextDetail.order.order_no}.` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to finalize order' });
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="space-y-6">
        <section className="surface-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Order Receiving</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Import Alabama Order</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Paste the copied Alabama order HTML block. The app saves the order and prepares each line for receiving verification.
          </p>
          <textarea
            value={html}
            onChange={event => setHtml(event.target.value)}
            className="control-input mt-4 min-h-44 w-full p-3 text-sm"
            placeholder="Paste Alabama order HTML block here..."
          />
          <button onClick={importOrder} disabled={isImporting || html.trim().length < 100} className="btn-primary mt-3 flex w-full items-center justify-center gap-2 px-4 py-3">
            <ClipboardPaste className="h-4 w-4" />
            {isImporting ? 'Importing...' : 'Import Order'}
          </button>
        </section>

        {message && (
          <div className={`rounded-2xl border p-4 text-sm font-medium ${message.type === 'success' ? 'border-lime-200 bg-lime-50 text-lime-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}

        <section className="surface-card overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/80 p-4">
            <h3 className="font-semibold text-slate-950">Saved Orders</h3>
          </div>
          <div className="max-h-[540px] divide-y divide-slate-100 overflow-y-auto">
            {isLoading ? (
              <div className="p-5 text-sm text-slate-500">Loading orders...</div>
            ) : orders.length === 0 ? (
              <div className="p-5 text-sm text-slate-500">No orders imported yet.</div>
            ) : orders.map(order => (
              <button
                key={order.id}
                onClick={() => loadDetail(order.id)}
                className={`w-full p-4 text-left transition-colors hover:bg-slate-50 ${detail?.order.id === order.id ? 'bg-lime-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-950">{order.order_no}</p>
                  <span className="status-chip border-slate-200 bg-white text-slate-600">{order.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{order.document_no} · {order.shipment_date || 'No shipment date'}</p>
                <p className="mt-2 text-xs text-slate-500">{order.line_count} lines · {order.matched_count} matched · {order.issue_count} issues</p>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="surface-card min-h-[720px] overflow-hidden">
        {!detail ? (
          <div className="flex h-full min-h-[520px] flex-col items-center justify-center p-8 text-center text-slate-500">
            <Truck className="mb-4 h-14 w-14 text-slate-300" />
            <h3 className="text-xl font-semibold text-slate-950">Select or import an order</h3>
            <p className="mt-2 max-w-md text-sm leading-6">Imported orders appear here for receiving verification and saved history.</p>
          </div>
        ) : (
          <div>
            <div className="border-b border-slate-200 bg-slate-50/80 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Receiving Order</p>
                  <h3 className="mt-1 text-2xl font-semibold text-slate-950">{detail.order.order_no}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {detail.order.document_no} · {detail.order.shipping_method} · {detail.order.shipment_date || 'No shipment date'}
                  </p>
                </div>
                <button onClick={finalizeOrder} disabled={detail.order.status === 'finalized' || (summary?.pending || 0) > 0} className="btn-primary px-5 py-2.5 text-sm">
                  Finalize Report
                </button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
                <SummaryCard label="Lines" value={detail.lines.length} />
                <SummaryCard label="Matched" value={summary?.matched || 0} />
                <SummaryCard label="Issues" value={summary?.issues || 0} />
                <SummaryCard label="Ordered Bottles" value={detail.order.total_ordered_bottles} />
                <SummaryCard label="Received Bottles" value={detail.order.total_received_bottles} />
              </div>

              <div className="relative mt-5">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  className="control-input w-full py-2.5 pl-10 pr-3 text-sm"
                  placeholder="Scan or type UPC/item number to jump to an order line..."
                />
              </div>
            </div>

            <div className="space-y-4 p-5">
              {detail.lines.map(line => (
                <div id={`order-line-${line.id}`} key={line.id} className="surface-panel p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`status-chip ${statusClass(line)}`}>{statusLabel(line)}</span>
                        <span className="status-chip border-slate-200 bg-slate-50 text-slate-500">{line.uom}</span>
                        {line.pack_size && <span className="status-chip border-slate-200 bg-slate-50 text-slate-500">Pack {line.pack_size}</span>}
                      </div>
                      <h4 className="mt-3 text-lg font-semibold text-slate-950">{line.title}</h4>
                      <p className="mt-1 text-xs font-mono text-slate-500">
                        UPC {line.upc || 'N/A'} · Item {line.item_no || 'N/A'} · Product {line.product_sku || 'Not matched'}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <Metric label="Ordered" value={line.ordered_bottles ?? 'Review'} />
                      <Metric label="Current" value={line.inventory_stock_snapshot ?? 'N/A'} />
                      <Metric label="Expected Rack" value={line.ordered_bottles === null ? 'Review' : expectedRack(line)} />
                    </div>
                  </div>

                  {line.issue_type === 'manual_review' && (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                        <div className="flex-1">
                          <p className="font-semibold text-amber-900">Manual product match required</p>
                          <p className="text-sm text-amber-800">This line has UPC `N/A`, no product match, or missing pack-size data.</p>
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <input
                              value={productSearch[line.id] || ''}
                              onChange={event => setProductSearch(prev => ({ ...prev, [line.id]: event.target.value }))}
                              className="control-input flex-1 px-3 py-2 text-sm"
                              placeholder="Search product by name, SKU, or UPC..."
                            />
                            <button onClick={() => searchProducts(line.id)} className="btn-secondary px-4 py-2 text-sm">
                              Search
                            </button>
                          </div>
                          {(productResults[line.id] || []).length > 0 && (
                            <div className="mt-3 grid gap-2">
                              {productResults[line.id].map(product => (
                                <button key={product.sku} onClick={() => matchProduct(line, product.sku)} className="rounded-2xl border border-slate-200 bg-white p-3 text-left text-sm hover:border-lime-300">
                                  <span className="font-semibold text-slate-950">{product.name}</span>
                                  <span className="ml-2 text-xs text-slate-500">SKU {product.sku} · Stock {product.stock} · Pack {product.pack || 'N/A'}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {line.product_sku && line.ordered_bottles !== null && (
                    <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1.5fr_auto_auto]">
                      <input
                        type="number"
                        min="0"
                        value={drafts[line.id]?.received || ''}
                        onChange={event => setDrafts(prev => ({ ...prev, [line.id]: { ...prev[line.id], received: event.target.value } }))}
                        className="control-input px-3 py-2 text-sm"
                        placeholder="Received bottles"
                      />
                      <input
                        type="number"
                        min="0"
                        value={drafts[line.id]?.finalRack || ''}
                        onChange={event => setDrafts(prev => ({ ...prev, [line.id]: { ...prev[line.id], finalRack: event.target.value } }))}
                        className="control-input px-3 py-2 text-sm"
                        placeholder="Final rack count"
                      />
                      <input
                        value={drafts[line.id]?.notes || ''}
                        onChange={event => setDrafts(prev => ({ ...prev, [line.id]: { ...prev[line.id], notes: event.target.value } }))}
                        className="control-input px-3 py-2 text-sm"
                        placeholder="Optional note"
                      />
                      <button
                        onClick={() => verifyLine(line, { received: String(line.ordered_bottles), finalRack: String(expectedRack(line)), notes: drafts[line.id]?.notes || '' })}
                        className="btn-accent flex items-center justify-center gap-2 px-4 py-2 text-sm"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Matched
                      </button>
                      <button onClick={() => verifyLine(line)} className="btn-primary px-4 py-2 text-sm">
                        Save Mismatch
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold text-slate-950">{value}</p>
    </div>
  );
}
