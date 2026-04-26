import express from 'express';
import { parseAlabamaOrderHtml, ParsedAlabamaOrderLine } from '../lib/alabamaOrderParser';
import { HttpError, requireStoreId, sendError } from '../lib/http';
import { importOrderHtmlSchema, matchOrderLineSchema, verifyOrderLineSchema } from '../lib/schemas';
import { ProductRow, SupplierOrderLineRow, SupplierOrderRow, supabaseAdmin } from '../lib/supabase';
import { requireAuth } from '../middlewares/auth';

const router = express.Router();
router.use(requireAuth);
const PRODUCT_PAGE_SIZE = 1000;

function parsePackSize(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value !== 'string') return null;
  const parsed = Number.parseInt(value.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidUpc(value: string) {
  return /^\d{6,}$/.test(value);
}

function normalizeCode(value: string) {
  return value.trim();
}

async function productsForStore(storeId: string) {
  const products: ProductRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .order('name', { ascending: true })
      .range(from, from + PRODUCT_PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data || []) as ProductRow[];
    products.push(...page);

    if (page.length < PRODUCT_PAGE_SIZE) break;
    from += PRODUCT_PAGE_SIZE;
  }

  return products;
}

function calculateOrderedBottles(line: ParsedAlabamaOrderLine, product: ProductRow | null) {
  if (line.uom.toLowerCase().includes('bottle')) return Math.round(line.ordered_qty);
  if (!line.uom.toLowerCase().includes('case')) return line.ordered_bottles;

  const packSize = line.pack_size || parsePackSize(product?.pack);
  return packSize ? Math.round(line.ordered_qty * packSize) : null;
}

function findProductByOrderLine(products: ProductRow[], line: ParsedAlabamaOrderLine) {
  const upc = normalizeCode(line.upc);
  if (!isValidUpc(upc)) return null;

  const variants = new Set([upc]);
  if (upc.length === 11) variants.add(`0${upc}`);
  if (upc.length > 8) variants.add(upc.slice(0, -1));

  const exact = products.find(product => {
    const codes = [product.sku, product.mainupc, ...(product.alt_upcs || [])].filter(Boolean);
    return codes.some(code => variants.has(code));
  });

  if (exact) return exact;

  if (upc.length >= 6) {
    const candidates = products
      .filter(product => {
        const codes = [product.mainupc, ...(product.alt_upcs || [])].filter(Boolean);
        return codes.some(code => code.includes(upc) || upc.includes(code));
      })
      .slice(0, 10);

    if (candidates.length === 1) return candidates[0];
  }

  return null;
}

async function findProductBySku(storeId: string, sku: string) {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .eq('sku', sku)
    .single();

  if (error || !data) throw new HttpError(404, 'Product not found');
  return data as ProductRow;
}

function mapOrder(row: SupplierOrderRow, lines: SupplierOrderLineRow[] = []) {
  const matched = lines.filter(line => line.issue_type === 'matched').length;
  const issues = lines.filter(line => !['pending', 'matched'].includes(line.issue_type)).length;
  const manualReview = lines.filter(line => line.issue_type === 'manual_review').length;
  const totalOrderedBottles = lines.reduce((sum, line) => sum + (line.ordered_bottles || 0), 0);
  const totalReceivedBottles = lines.reduce((sum, line) => sum + (line.received_bottles || 0), 0);

  return {
    ...row,
    raw_html: undefined,
    line_count: lines.length,
    matched_count: matched,
    issue_count: issues,
    manual_review_count: manualReview,
    total_ordered_bottles: totalOrderedBottles,
    total_received_bottles: totalReceivedBottles,
  };
}

async function loadOrder(storeId: string, orderId: string) {
  const { data: order, error } = await supabaseAdmin
    .from('supplier_orders')
    .select('*')
    .eq('store_id', storeId)
    .eq('id', orderId)
    .single();
  if (error || !order) throw new HttpError(404, 'Order not found');

  const { data: lines, error: linesError } = await supabaseAdmin
    .from('supplier_order_lines')
    .select('*')
    .eq('store_id', storeId)
    .eq('order_id', orderId)
    .order('line_index', { ascending: true });
  if (linesError) throw linesError;

  return {
    order: mapOrder(order as SupplierOrderRow, (lines || []) as SupplierOrderLineRow[]),
    lines: (lines || []) as SupplierOrderLineRow[],
  };
}

router.post('/import-html', async (req, res) => {
  try {
    const storeId = requireStoreId(req);
    const { html } = importOrderHtmlSchema.parse(req.body);
    const parsed = parseAlabamaOrderHtml(html);

    const { data: order, error } = await supabaseAdmin
      .from('supplier_orders')
      .upsert({
        store_id: storeId,
        document_no: parsed.document_no,
        order_no: parsed.order_no,
        shipping_method: parsed.shipping_method,
        shipment_date: parsed.shipment_date,
        order_date: parsed.order_date,
        document_date: parsed.document_date,
        location_code: parsed.location_code,
        payment_status: parsed.payment_status,
        payment_method: parsed.payment_method,
        subtotal: parsed.subtotal,
        total: parsed.total,
        raw_html: html,
        status: 'draft',
        finalized_at: null,
      }, { onConflict: 'store_id,document_no,order_no' })
      .select('*')
      .single();

    if (error || !order) throw error || new Error('Failed to save order');

    const orderId = order.id as string;
    const { error: deleteError } = await supabaseAdmin
      .from('supplier_order_lines')
      .delete()
      .eq('store_id', storeId)
      .eq('order_id', orderId);
    if (deleteError) throw deleteError;

    const products = await productsForStore(storeId);
    const lines = [];
    for (const line of parsed.lines) {
      const product = findProductByOrderLine(products, line);
      const orderedBottles = calculateOrderedBottles(line, product);
      const needsReview = !product || orderedBottles === null || !isValidUpc(line.upc);

      lines.push({
        ...line,
        order_id: orderId,
        store_id: storeId,
        pack_size: line.pack_size || parsePackSize(product?.pack),
        ordered_bottles: orderedBottles,
        product_sku: product?.sku || null,
        product_name: product?.name || null,
        product_upc: product?.mainupc || null,
        inventory_stock_snapshot: product?.stock ?? null,
        inventory_pack_snapshot: product?.pack || null,
        status: needsReview ? 'manual_review' : 'pending',
        issue_type: needsReview ? 'manual_review' : 'pending',
      });
    }

    if (lines.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('supplier_order_lines')
        .insert(lines);
      if (insertError) throw insertError;
    }

    return res.json(await loadOrder(storeId, orderId));
  } catch (error) {
    return sendError(res, error, 'Failed to import order');
  }
});

router.get('/', async (req, res) => {
  try {
    const storeId = requireStoreId(req);
    const { data: orders, error } = await supabaseAdmin
      .from('supplier_orders')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const orderIds = (orders || []).map(order => order.id);
    const { data: lines, error: linesError } = orderIds.length
      ? await supabaseAdmin
        .from('supplier_order_lines')
        .select('*')
        .eq('store_id', storeId)
        .in('order_id', orderIds)
      : { data: [], error: null };
    if (linesError) throw linesError;

    const linesByOrder = new Map<string, SupplierOrderLineRow[]>();
    for (const line of (lines || []) as SupplierOrderLineRow[]) {
      linesByOrder.set(line.order_id, [...(linesByOrder.get(line.order_id) || []), line]);
    }

    return res.json((orders || []).map(order => mapOrder(order as SupplierOrderRow, linesByOrder.get(order.id) || [])));
  } catch (error) {
    return sendError(res, error, 'Failed to fetch orders');
  }
});

router.get('/:id', async (req, res) => {
  try {
    return res.json(await loadOrder(requireStoreId(req), req.params.id));
  } catch (error) {
    return sendError(res, error, 'Failed to fetch order');
  }
});

router.put('/:id/lines/:lineId/match-product', async (req, res) => {
  try {
    const storeId = requireStoreId(req);
    const { product_sku } = matchOrderLineSchema.parse(req.body);
    const product = await findProductBySku(storeId, product_sku);

    const { data: line, error: lineError } = await supabaseAdmin
      .from('supplier_order_lines')
      .select('*')
      .eq('store_id', storeId)
      .eq('order_id', req.params.id)
      .eq('id', req.params.lineId)
      .single();
    if (lineError || !line) throw new HttpError(404, 'Order line not found');

    const typedLine = line as SupplierOrderLineRow;
    const packSize = typedLine.pack_size || parsePackSize(product.pack);
    const orderedBottles = typedLine.uom.toLowerCase().includes('case') && packSize
      ? Math.round(Number(typedLine.ordered_qty) * packSize)
      : typedLine.ordered_bottles;
    const needsReview = orderedBottles === null;

    const { error } = await supabaseAdmin
      .from('supplier_order_lines')
      .update({
        product_sku: product.sku,
        product_name: product.name,
        product_upc: product.mainupc,
        inventory_stock_snapshot: product.stock,
        inventory_pack_snapshot: product.pack,
        pack_size: packSize,
        ordered_bottles: orderedBottles,
        status: needsReview ? 'manual_review' : 'pending',
        issue_type: needsReview ? 'manual_review' : 'pending',
      })
      .eq('store_id', storeId)
      .eq('order_id', req.params.id)
      .eq('id', req.params.lineId);

    if (error) throw error;
    return res.json(await loadOrder(storeId, req.params.id));
  } catch (error) {
    return sendError(res, error, 'Failed to match product');
  }
});

router.put('/:id/lines/:lineId/verify', async (req, res) => {
  try {
    const storeId = requireStoreId(req);
    const body = verifyOrderLineSchema.parse(req.body);
    const { data: line, error: lineError } = await supabaseAdmin
      .from('supplier_order_lines')
      .select('*')
      .eq('store_id', storeId)
      .eq('order_id', req.params.id)
      .eq('id', req.params.lineId)
      .single();
    if (lineError || !line) throw new HttpError(404, 'Order line not found');

    const typedLine = line as SupplierOrderLineRow;
    const databaseRackCount = typedLine.inventory_stock_snapshot || 0;
    let issueType: SupplierOrderLineRow['issue_type'] = 'matched';
    if (typedLine.ordered_bottles !== null && body.received_bottles < typedLine.ordered_bottles) issueType = 'short_received';
    else if (typedLine.ordered_bottles !== null && body.received_bottles > typedLine.ordered_bottles) issueType = 'extra_received';
    else if (body.final_rack_count !== databaseRackCount) issueType = 'rack_mismatch';

    const { error } = await supabaseAdmin
      .from('supplier_order_lines')
      .update({
        received_bottles: body.received_bottles,
        final_rack_count: body.final_rack_count,
        notes: body.notes,
        status: issueType === 'matched' ? 'matched' : 'mismatched',
        issue_type: issueType,
        verified_at: new Date().toISOString(),
      })
      .eq('store_id', storeId)
      .eq('order_id', req.params.id)
      .eq('id', req.params.lineId);

    if (error) throw error;

    await supabaseAdmin
      .from('supplier_orders')
      .update({ status: 'in_progress' })
      .eq('store_id', storeId)
      .eq('id', req.params.id)
      .neq('status', 'finalized');

    return res.json(await loadOrder(storeId, req.params.id));
  } catch (error) {
    return sendError(res, error, 'Failed to verify order line');
  }
});

router.post('/:id/finalize', async (req, res) => {
  try {
    const storeId = requireStoreId(req);
    const detail = await loadOrder(storeId, req.params.id);
    const pending = detail.lines.filter(line => line.issue_type === 'pending' || line.issue_type === 'manual_review');
    if (pending.length > 0) {
      throw new HttpError(400, 'Resolve all pending/manual review lines before finalizing');
    }

    const { error } = await supabaseAdmin
      .from('supplier_orders')
      .update({ status: 'finalized', finalized_at: new Date().toISOString() })
      .eq('store_id', storeId)
      .eq('id', req.params.id);
    if (error) throw error;

    return res.json(await loadOrder(storeId, req.params.id));
  } catch (error) {
    return sendError(res, error, 'Failed to finalize order');
  }
});

export default router;
