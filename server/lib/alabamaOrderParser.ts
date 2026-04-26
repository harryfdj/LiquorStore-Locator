import * as cheerio from 'cheerio';

export type ParsedAlabamaOrderLine = {
  line_index: number;
  upc: string;
  item_no: string;
  title: string;
  shipment_date: string | null;
  price: number;
  discount: string;
  ordered_qty: number;
  uom: string;
  pack_size: number | null;
  ordered_bottles: number | null;
  outstanding_qty: number;
  line_total: number;
};

export type ParsedAlabamaOrder = {
  document_no: string;
  order_no: string;
  shipping_method: string;
  shipment_date: string | null;
  order_date: string | null;
  document_date: string | null;
  location_code: string;
  payment_status: string;
  payment_method: string;
  subtotal: number;
  total: number;
  lines: ParsedAlabamaOrderLine[];
};

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function parseMoney(value: string) {
  const normalized = value.replace(/[$,\s]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNumber(value: string) {
  const normalized = value.replace(/[,\s]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseOptionalInteger(value: string) {
  const normalized = cleanText(value);
  if (!normalized || normalized.toLowerCase() === 'n/a') return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value: string) {
  const normalized = cleanText(value);
  if (!normalized) return null;

  const [month, day, year] = normalized.split('/').map(part => Number.parseInt(part, 10));
  if (!month || !day || !year) return null;

  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function getInfoValue($: cheerio.CheerioAPI, label: string) {
  let value = '';
  $('.Order_general-info dt').each((_, element) => {
    if (cleanText($(element).text()).toLowerCase() === label.toLowerCase()) {
      value = cleanText($(element).next('dd').text());
    }
  });
  return value;
}

function getTotalByLabel($: cheerio.CheerioAPI, label: string) {
  let value = 0;
  $('.Order_totals-table tr').each((_, row) => {
    const name = cleanText($(row).find('.Order_totals-name').first().text());
    if (name.toLowerCase() === label.toLowerCase()) {
      value = parseMoney($(row).find('.Order_totals-value').first().text());
    }
  });
  return value;
}

function getCellText($: cheerio.CheerioAPI, row: cheerio.Cheerio<any>, selector: string) {
  return cleanText(row.find(selector).first().text());
}

function getCellByHeader($: cheerio.CheerioAPI, row: cheerio.Cheerio<any>, header: string) {
  const table = row.closest('table');
  const headers = table.find('thead th').toArray().map(th => cleanText($(th).text()).toLowerCase());
  const index = headers.findIndex(text => text === header.toLowerCase());
  if (index === -1) return '';
  return cleanText(row.children().eq(index).text());
}

export function parseAlabamaOrderHtml(html: string): ParsedAlabamaOrder {
  const $ = cheerio.load(html);

  const document_no = getInfoValue($, 'Document no.');
  const order_no = getInfoValue($, 'Order no.');
  if (!document_no || !order_no) {
    throw new Error('Could not find Alabama order document/order number in HTML.');
  }

  const lines: ParsedAlabamaOrderLine[] = [];
  $('.Order_product-line').each((lineIndex, element) => {
    const row = $(element);
    const upc = getCellByHeader($, row, 'UPC') || 'N/A';
    const item_no = getCellText($, row, '.Order_line-id');
    const title = getCellText($, row, '.Order_line-title');
    const uom = getCellText($, row, '.Order_line-uom');
    const ordered_qty = parseNumber(getCellText($, row, '.Order_line-qty'));
    const pack_size = parseOptionalInteger(getCellByHeader($, row, 'Pack Size'));

    let ordered_bottles: number | null = null;
    if (uom.toLowerCase().includes('bottle')) ordered_bottles = Math.round(ordered_qty);
    if (uom.toLowerCase().includes('case') && pack_size) ordered_bottles = Math.round(ordered_qty * pack_size);

    if (!title) return;

    lines.push({
      line_index: lineIndex,
      upc,
      item_no,
      title,
      shipment_date: normalizeDate(getCellText($, row, '.Order_line-shipment-date')),
      price: parseMoney(getCellText($, row, '.Order_line-price')),
      discount: getCellText($, row, '.Order_line-discount'),
      ordered_qty,
      uom,
      pack_size,
      ordered_bottles,
      outstanding_qty: parseNumber(getCellText($, row, '.Order_line-qty-outstanding')),
      line_total: parseMoney(getCellText($, row, '.Order_line-total')),
    });
  });

  return {
    document_no,
    order_no,
    shipping_method: getInfoValue($, 'Shipping method'),
    shipment_date: normalizeDate(getInfoValue($, 'Shipment date')),
    order_date: normalizeDate(getInfoValue($, 'Order date')),
    document_date: normalizeDate(getInfoValue($, 'Document date')),
    location_code: getInfoValue($, 'Location'),
    payment_status: getInfoValue($, 'Payment status'),
    payment_method: getInfoValue($, 'Payment method'),
    subtotal: getTotalByLabel($, 'Subtotal'),
    total: getTotalByLabel($, 'Total incl. tax') || getTotalByLabel($, 'Total'),
    lines,
  };
}
