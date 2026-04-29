import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, ClipboardPaste, Lock, Minus, Plus, Search, Trash2, Truck } from 'lucide-react';
import Barcode from 'react-barcode';
import { AdminConfirmModal } from './AdminConfirmModal';
import { apiFetch, apiJson } from '../lib/api';
import { Product, SupplierOrderDetail, SupplierOrderLine, SupplierOrderSummary } from '../types';

type PendingOrderDelete = {
  id: string;
  orderNo: string;
  documentNo: string;
  lineCount: number;
};

type LineDraft = {
  received: string;
  rackCount: string;
  notes: string;
};

type LineFilter = 'all' | 'verified' | 'not_verified' | 'matched' | 'issues';

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

function draftExpectedRack(line: SupplierOrderLine, draft?: LineDraft) {
  const received = Number(draft?.received ?? line.received_bottles ?? line.ordered_bottles ?? 0);
  const rackCount = Number(draft?.rackCount ?? line.final_rack_count ?? line.inventory_stock_snapshot ?? 0);
  return (Number.isFinite(received) ? received : 0) + (Number.isFinite(rackCount) ? rackCount : 0);
}

function isLineVerified(line: SupplierOrderLine) {
  return !['pending', 'manual_review'].includes(line.issue_type);
}

/** Lines counted in the Issues summary (not pending, not cleanly matched). */
function isIssueSummaryLine(line: SupplierOrderLine) {
  return !['pending', 'matched'].includes(line.issue_type);
}

function isRenderableUpc(value: string | null | undefined) {
  return Boolean(value && /^\d{6,}$/.test(value.trim()));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function costPerBottle(line: SupplierOrderLine) {
  if (line.uom.toLowerCase().includes('case')) {
    return line.pack_size ? line.price / line.pack_size : null;
  }

  return line.price;
}

function costPerBottleLabel(line: SupplierOrderLine) {
  const cost = costPerBottle(line);
  return cost === null ? 'N/A' : formatCurrency(cost);
}

function adjustQuantity(value: string, delta: number) {
  const current = Number(value || 0);
  const next = (Number.isFinite(current) ? Math.trunc(current) : 0) + delta;
  return String(Math.max(0, next));
}

function sanitizeQuantityInput(value: string) {
  if (value === '') return '';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  return String(Math.max(0, Math.trunc(parsed)));
}

function matchesLineSearch(line: SupplierOrderLine, needle: string) {
  const normalized = needle.trim().toLowerCase();
  if (!normalized) return true;

  return [
    line.upc,
    line.product_upc,
    line.item_no,
    line.product_sku,
    line.title,
    line.product_name,
  ].filter(Boolean).some(value => value!.toLowerCase().includes(normalized));
}

export function OrdersTab({ searchQuery, setSearchQuery }: OrdersTabProps) {
  const [orders, setOrders] = useState<SupplierOrderSummary[]>([]);
  const [detail, setDetail] = useState<SupplierOrderDetail | null>(null);
  const [html, setHtml] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingOrderDelete | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({});
  const [productSearch, setProductSearch] = useState<Record<string, string>>({});
  const [productResults, setProductResults] = useState<Record<string, Product[]>>({});
  const [isVerificationMode, setIsVerificationMode] = useState(false);
  const [lineFilter, setLineFilter] = useState<LineFilter>('all');

  const loadOrders = async () => {
    setOrders(await apiJson<SupplierOrderSummary[]>('/api/orders'));
  };

  const loadDetail = async (orderId: string) => {
    const nextDetail = await apiJson<SupplierOrderDetail>(`/api/orders/${orderId}`);
    setDetail(nextDetail);
    setIsVerificationMode(false);
    setSearchQuery('');
    setLineFilter('all');
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
        rackCount: String(
          line.issue_type === 'pending' || line.issue_type === 'manual_review'
            ? line.inventory_stock_snapshot ?? 0
            : line.final_rack_count ?? line.inventory_stock_snapshot ?? 0
        ),
        notes: line.notes || '',
      };
    }
    setDrafts(nextDrafts);
  }, [detail?.order.id]);

  useEffect(() => {
    if (pendingDelete === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isDeleting) return;
      setPendingDelete(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pendingDelete, isDeleting]);

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

  const visibleLines = useMemo(() => {
    if (!detail) return [];
    const needle = searchQuery.trim().toLowerCase();
    const filteredByStatus = detail.lines.filter(line => {
      if (lineFilter === 'verified') return isLineVerified(line);
      if (lineFilter === 'not_verified') return !isLineVerified(line);
      if (lineFilter === 'matched') return line.issue_type === 'matched';
      if (lineFilter === 'issues') return isIssueSummaryLine(line);
      return true;
    });

    if (!needle) return isVerificationMode ? [] : filteredByStatus;

    return filteredByStatus.filter(line => matchesLineSearch(line, needle));
  }, [detail, searchQuery, lineFilter, isVerificationMode]);

  const summary = useMemo(() => {
    if (!detail) return null;
    return {
      matched: detail.lines.filter(line => line.issue_type === 'matched').length,
      issues: detail.lines.filter(line => isIssueSummaryLine(line)).length,
      pending: detail.lines.filter(line => ['pending', 'manual_review'].includes(line.issue_type)).length,
    };
  }, [detail]);

  const orderLocked = detail?.order.status === 'finalized';

  const importOrder = async () => {
    setIsImporting(true);
    setMessage(null);
    try {
      const imported = await apiJson<SupplierOrderDetail>('/api/orders/import-html', {
        method: 'POST',
        body: JSON.stringify({ html }),
      });
      setDetail(imported);
      setLineFilter('all');
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
    if (!detail || detail.order.status === 'finalized') return;
    const nextDetail = await apiJson<SupplierOrderDetail>(`/api/orders/${detail.order.id}/lines/${line.id}/match-product`, {
      method: 'PUT',
      body: JSON.stringify({ product_sku: sku }),
    });
    setDetail(nextDetail);
    await loadOrders();
  };

  const verifyLine = async (line: SupplierOrderLine, values?: Partial<LineDraft>) => {
    if (!detail || detail.order.status === 'finalized') return;
    const draft = { ...drafts[line.id], ...values };
    const nextDetail = await apiJson<SupplierOrderDetail>(`/api/orders/${detail.order.id}/lines/${line.id}/verify`, {
      method: 'PUT',
      body: JSON.stringify({
        received_bottles: draft.received,
        final_rack_count: draft.rackCount,
        notes: draft.notes,
      }),
    });
    setDetail(nextDetail);
    await loadOrders();
    if (isVerificationMode) setSearchQuery('');
  };

  const finalizeOrder = async () => {
    if (!detail) return;
    try {
      const nextDetail = await apiJson<SupplierOrderDetail>(`/api/orders/${detail.order.id}/finalize`, { method: 'POST' });
      setDetail(nextDetail);
      setIsVerificationMode(false);
      await loadOrders();
      setMessage({ type: 'success', text: `Finalized order ${nextDetail.order.order_no}.` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to finalize order' });
    }
  };

  const openDeleteOrderDialog = (target: PendingOrderDelete) => {
    setPendingDelete(target);
  };

  const closeDeleteOrderDialog = () => {
    if (!isDeleting) setPendingDelete(null);
  };

  const confirmDeleteImportedOrder = async () => {
    if (!pendingDelete) return;
    const { id, orderNo } = pendingDelete;
    setIsDeleting(true);
    setMessage(null);
    try {
      await apiFetch(`/api/orders/${id}`, { method: 'DELETE' });
      setPendingDelete(null);
      if (detail?.order.id === id) setDetail(null);
      await loadOrders();
      setMessage({ type: 'success', text: `Deleted order ${orderNo}.` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to delete order' });
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteOrderModalMessage = pendingDelete
    ? [
        `Order ${pendingDelete.orderNo} · Document ${pendingDelete.documentNo}`,
        '',
        `This removes ${pendingDelete.lineCount} line${pendingDelete.lineCount === 1 ? '' : 's'} and all receiving verification progress for this import.`,
        'This action cannot be undone.',
      ].join('\n')
    : '';

  return (
    <>
    <AdminConfirmModal
      isOpen={pendingDelete !== null}
      onClose={closeDeleteOrderDialog}
      onConfirm={confirmDeleteImportedOrder}
      title="Delete this Alabama import?"
      message={deleteOrderModalMessage}
      confirmText="Delete import"
      variant="danger"
      isLoading={isDeleting}
      leadIcon={<Truck className="h-8 w-8" />}
    />
    <div className={isVerificationMode ? 'space-y-6' : 'grid gap-6 xl:grid-cols-[360px_1fr]'}>
      {!isVerificationMode && (
      <div className="space-y-6">
        <section className="surface-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Order Receiving</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Import Alabama Order</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Paste the copied Alabama order HTML block. The app saves the order and prepares each line for receiving verification. If you import the wrong order, delete it from Saved Orders before you finalize the report.
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
          <div className="max-h-[540px] overflow-y-auto">
            {isLoading ? (
              <div className="p-5 text-sm text-slate-500">Loading orders...</div>
            ) : orders.length === 0 ? (
              <div className="p-5 text-sm text-slate-500">No orders imported yet.</div>
            ) : orders.map(order => (
              <div
                key={order.id}
                className={`flex items-stretch border-b border-slate-100 last:border-b-0 ${detail?.order.id === order.id ? 'bg-lime-50' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => loadDetail(order.id)}
                  className="min-w-0 flex-1 p-4 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-950">{order.order_no}</p>
                    <span className="status-chip border-slate-200 bg-white text-slate-600">{order.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{order.document_no} · {order.shipment_date || 'No shipment date'}</p>
                  <p className="mt-2 text-xs text-slate-500">{order.line_count} lines · {order.matched_count} matched · {order.issue_count} issues</p>
                </button>
                {order.status !== 'finalized' && (
                  <button
                    type="button"
                    title="Delete this import"
                    disabled={isDeleting}
                    onClick={() =>
                      openDeleteOrderDialog({
                        id: order.id,
                        orderNo: order.order_no,
                        documentNo: order.document_no,
                        lineCount: order.line_count,
                      })
                    }
                    className="shrink-0 border-l border-slate-100 px-3 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="mx-auto h-4 w-4" />
                    <span className="sr-only">Delete order {order.order_no}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
      )}

      <section className="surface-card min-h-[720px] overflow-hidden">
        {!detail ? (
          <div className="flex h-full min-h-[520px] flex-col items-center justify-center p-8 text-center text-slate-500">
            <Truck className="mb-4 h-14 w-14 text-slate-300" />
            <h3 className="text-xl font-semibold text-slate-950">Select or import an order</h3>
            <p className="mt-2 max-w-md text-sm leading-6">Imported orders appear here for receiving verification and saved history.</p>
          </div>
        ) : (
          <div>
            <div className="border-b border-slate-200 bg-slate-50/80 p-3 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Receiving Order</p>
                  <h3 className="mt-1 text-2xl font-semibold text-slate-950">{detail.order.order_no}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {detail.order.document_no}
                    {' · '}
                    {detail.order.shipping_method || 'No shipping method'}
                    {' · '}
                    {detail.order.shipment_date || 'No shipment date'}
                    {' · Location · '}
                    {detail.order.location_code || 'No location'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={orderLocked}
                    onClick={() => {
                      setIsVerificationMode(!isVerificationMode);
                      setSearchQuery('');
                    }}
                    className={isVerificationMode ? 'btn-secondary px-5 py-2.5 text-sm' : 'btn-accent px-5 py-2.5 text-sm'}
                  >
                    {isVerificationMode ? 'Exit Verification Mode' : 'Verification Mode'}
                  </button>
                  <button type="button" onClick={finalizeOrder} disabled={orderLocked || (summary?.pending || 0) > 0} className="btn-primary px-5 py-2.5 text-sm">
                    Finalize Report
                  </button>
                </div>
              </div>

              {orderLocked && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                  <p>
                    <span className="font-semibold text-slate-950">Finalized report.</span>{' '}
                    Receiving counts, rack values, notes, and product matches cannot be changed for this order.
                  </p>
                </div>
              )}

              <div className="mt-5 hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-5">
                <SummaryStatCard
                  label="Lines"
                  value={detail.lines.length}
                  active={lineFilter === 'all'}
                  title="Show all order lines"
                  onClick={() => {
                    setLineFilter('all');
                    setSearchQuery('');
                  }}
                />
                <SummaryStatCard
                  label="Matched"
                  value={summary?.matched || 0}
                  active={lineFilter === 'matched'}
                  title="Show matched lines only"
                  onClick={() => {
                    setLineFilter('matched');
                    setSearchQuery('');
                  }}
                />
                <SummaryStatCard
                  label="Issues"
                  value={summary?.issues || 0}
                  active={lineFilter === 'issues'}
                  title="Show issue lines (short, extra, rack mismatch, manual review)"
                  onClick={() => {
                    setLineFilter('issues');
                    setSearchQuery('');
                  }}
                />
                <SummaryStatCard label="Ordered Bottles" value={detail.order.total_ordered_bottles} />
                <SummaryStatCard label="Received Bottles" value={detail.order.total_received_bottles} />
              </div>

              {!isVerificationMode && (
                <div className="relative mt-5">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={event => setSearchQuery(event.target.value)}
                    className="control-input w-full py-2.5 pl-10 pr-3 text-sm"
                    placeholder="Scan or type UPC, item number, SKU, or name to show only that item..."
                  />
                </div>
              )}
            </div>

            <div className="space-y-3 p-3 sm:space-y-4 sm:p-5">
              {!isVerificationMode && (
                <div className="flex flex-wrap gap-2">
                  <FilterButton
                    active={lineFilter === 'all'}
                    onClick={() => {
                      setLineFilter('all');
                      setSearchQuery('');
                    }}
                  >
                    All lines
                  </FilterButton>
                  <FilterButton
                    active={lineFilter === 'not_verified'}
                    onClick={() => {
                      setLineFilter('not_verified');
                      setSearchQuery('');
                    }}
                  >
                    Not verified
                  </FilterButton>
                  <FilterButton
                    active={lineFilter === 'verified'}
                    onClick={() => {
                      setLineFilter('verified');
                      setSearchQuery('');
                    }}
                  >
                    Verified
                  </FilterButton>
                </div>
              )}

              {isVerificationMode && !searchQuery.trim() && (
                <div className="mx-auto flex min-h-[360px] max-w-3xl flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <Search className="mb-4 h-12 w-12 text-slate-300" />
                  <h4 className="text-2xl font-semibold text-slate-950">Scan an item to verify</h4>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                    The matching order line will appear here. Mark it matched or save a mismatch, then the screen clears for the next scan.
                  </p>
                </div>
              )}

              {!isVerificationMode && searchQuery.trim() && (
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <span>Showing {visibleLines.length} of {detail.lines.length} order lines for "{searchQuery.trim()}".</span>
                  <button type="button" onClick={() => setSearchQuery('')} className="font-semibold text-slate-950 hover:text-lime-700">
                    Clear search
                  </button>
                </div>
              )}

              {!isVerificationMode && !searchQuery.trim() && (lineFilter === 'matched' || lineFilter === 'issues') && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <span>
                    {lineFilter === 'matched'
                      ? `Showing matched lines only (${visibleLines.length} of ${detail.lines.length}).`
                      : `Showing issue lines only (${visibleLines.length} of ${detail.lines.length}).`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setLineFilter('all');
                      setSearchQuery('');
                    }}
                    className="font-semibold text-slate-950 hover:text-lime-700"
                  >
                    Show all lines
                  </button>
                </div>
              )}

              {visibleLines.length === 0 && (!isVerificationMode || searchQuery.trim()) ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-medium text-amber-800">
                  {searchQuery.trim()
                    ? 'No order line matches this search.'
                    : lineFilter === 'matched'
                      ? 'No matched lines yet. Verify items as matched to see them here.'
                      : lineFilter === 'issues'
                        ? 'No issue lines. Issues include short received, extra received, rack mismatch, and manual review.'
                        : lineFilter === 'verified'
                          ? 'No verified lines yet.'
                          : lineFilter === 'not_verified'
                            ? 'All lines are verified.'
                            : 'No order lines in this import.'}
                </div>
              ) : visibleLines.map(line => (
                <div id={`order-line-${line.id}`} key={line.id} className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:pb-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`status-chip ${statusClass(line)}`}>{statusLabel(line)}</span>
                        <span className="status-chip border-slate-200 bg-slate-50 text-slate-600">{line.uom}</span>
                        {line.pack_size && <span className="status-chip border-slate-200 bg-slate-50 text-slate-600">Pack {line.pack_size}</span>}
                      </div>
                      <h4 className="mt-2 text-lg font-semibold leading-snug text-slate-950 sm:mt-3 sm:text-xl">{line.title}</h4>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                        <span>UPC <span className="font-mono text-slate-700">{line.upc || 'N/A'}</span></span>
                        <span>Item <span className="font-mono text-slate-700">{line.item_no || 'N/A'}</span></span>
                        <span>Product <span className="font-mono text-slate-700">{line.product_sku || 'Not matched'}</span></span>
                      </div>
                    </div>
                    {isRenderableUpc(line.upc) && (
                      <div className="flex shrink-0 justify-center overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 p-2">
                        <Barcode value={line.upc.trim()} format="CODE128" width={1.5} height={34} fontSize={12} background="transparent" />
                      </div>
                    )}
                  </div>

                  <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-3">
                    <Metric label="Ordered Bottles" value={line.ordered_bottles ?? 'Review'} />
                    <Metric label="Cost / Bottle" value={costPerBottleLabel(line)} />
                    <Metric label="Current Rack Count" value={line.inventory_stock_snapshot ?? 'N/A'} />
                    <Metric label="Expected Rack After Delivery" value={line.ordered_bottles === null ? 'Review' : draftExpectedRack(line, drafts[line.id])} />
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
                              disabled={orderLocked}
                              className="control-input flex-1 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                              placeholder="Search product by name, SKU, or UPC..."
                            />
                            <button type="button" disabled={orderLocked} onClick={() => searchProducts(line.id)} className="btn-secondary px-4 py-2 text-sm">
                              Search
                            </button>
                          </div>
                          {(productResults[line.id] || []).length > 0 && (
                            <div className="mt-3 grid gap-2">
                              {productResults[line.id].map(product => (
                                <button
                                  key={product.sku}
                                  type="button"
                                  disabled={orderLocked}
                                  onClick={() => matchProduct(line, product.sku)}
                                  className="rounded-2xl border border-slate-200 bg-white p-3 text-left text-sm hover:border-lime-300 disabled:cursor-not-allowed disabled:opacity-60"
                                >
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
                    <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-3 sm:mt-5 sm:p-4">
                      <div className="mb-3 sm:mb-4">
                        <p className="text-sm font-semibold text-slate-950">Receive this item</p>
                        <p className="text-xs text-slate-500">
                          {orderLocked
                            ? 'This order is finalized. These values are read-only.'
                            : 'If the delivery is correct, use the green button. If not, enter the actual counts and save a mismatch.'}
                        </p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <QuantityStepper
                          label="Received bottles"
                          value={drafts[line.id]?.received || ''}
                          disabled={orderLocked}
                          onChange={value => setDrafts(prev => ({ ...prev, [line.id]: { ...prev[line.id], received: value } }))}
                        />
                        <QuantityStepper
                          label="Rack count"
                          value={drafts[line.id]?.rackCount || ''}
                          disabled={orderLocked}
                          onChange={value => setDrafts(prev => ({ ...prev, [line.id]: { ...prev[line.id], rackCount: value } }))}
                        />
                        <label className="block">
                          <span className="field-label">Note</span>
                          <input
                            value={drafts[line.id]?.notes || ''}
                            onChange={event => setDrafts(prev => ({ ...prev, [line.id]: { ...prev[line.id], notes: event.target.value } }))}
                            disabled={orderLocked}
                            className="control-input mt-1 w-full px-3 py-3 text-base disabled:cursor-not-allowed disabled:opacity-60"
                            placeholder="Optional"
                          />
                        </label>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          disabled={orderLocked}
                          onClick={() => verifyLine(line, { received: String(line.ordered_bottles), rackCount: String(line.inventory_stock_snapshot ?? 0), notes: drafts[line.id]?.notes || '' })}
                          className="btn-accent flex min-h-12 items-center justify-center gap-2 px-4 py-3 text-base"
                        >
                          <CheckCircle className="h-5 w-5" />
                          Mark as Matched
                        </button>
                        <button type="button" disabled={orderLocked} onClick={() => verifyLine(line)} className="btn-primary min-h-12 px-4 py-3 text-base">
                          Save as Mismatch
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
    </>
  );
}

function SummaryStatCard({
  label,
  value,
  onClick,
  active = false,
  title,
}: {
  label: string;
  value: string | number;
  onClick?: () => void;
  active?: boolean;
  title?: string;
}) {
  const interactive = typeof onClick === 'function';
  const shellClass = `rounded-2xl border p-3 text-left transition-colors ${
    interactive
      ? active
        ? 'border-lime-400 bg-lime-50/70 ring-2 ring-lime-200/90 shadow-sm'
        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      : 'border-slate-200 bg-white'
  }`;
  const body = (
    <>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
    </>
  );
  if (interactive) {
    return (
      <button type="button" className={`${shellClass} w-full`} onClick={onClick} title={title} aria-pressed={active}>
        {body}
      </button>
    );
  }
  return <div className={shellClass}>{body}</div>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? 'border-slate-950 bg-slate-950 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950'
      }`}
    >
      {children}
    </button>
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

function QuantityStepper({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const stepperButtonBase = 'flex min-h-12 items-center justify-center font-semibold shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <div className="mt-1 grid grid-cols-[56px_1fr_56px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-inner shadow-slate-200/40 focus-within:border-lime-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-lime-200/50">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(adjustQuantity(value, -1))}
          className={`${stepperButtonBase} border-r border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950`}
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-5 w-5 stroke-[2.5]" aria-hidden />
        </button>
        <input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={value}
          onChange={event => onChange(sanitizeQuantityInput(event.target.value))}
          disabled={disabled}
          className="min-w-0 border-0 bg-transparent px-3 py-3 text-center font-semibold text-slate-950 outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(adjustQuantity(value, 1))}
          className={`${stepperButtonBase} border-l border-lime-200 bg-lime-100 text-slate-950 hover:bg-lime-200`}
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-5 w-5 stroke-[2.5]" aria-hidden />
        </button>
      </div>
    </label>
  );
}
