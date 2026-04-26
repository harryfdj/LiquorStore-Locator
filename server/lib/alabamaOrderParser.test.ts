import { describe, expect, it } from 'vitest';
import { parseAlabamaOrderHtml } from './alabamaOrderParser';

const directDeliveryHtml = `
  <dl class="Order_general-info">
    <dt>Document no.</dt><dd>DOC-1001</dd>
    <dt>Order no.</dt><dd>ORD-2001</dd>
    <dt>Shipping method</dt><dd>Direct Delivery</dd>
    <dt>Shipment date</dt><dd>04/25/2026</dd>
    <dt>Order date</dt><dd>04/23/2026</dd>
    <dt>Document date</dt><dd>04/24/2026</dd>
    <dt>Location</dt><dd>001</dd>
    <dt>Payment status</dt><dd>Paid</dd>
    <dt>Payment method</dt><dd>ACH</dd>
  </dl>
  <table>
    <thead>
      <tr>
        <th>UPC</th><th>Item No.</th><th>Title</th><th>Shipment date</th><th>Price</th><th>Discount</th><th>Qty</th><th>Pack Size</th><th>UOM</th><th>Qty Outstanding</th><th>Total</th>
      </tr>
    </thead>
    <tbody>
      <tr class="Order_product-line">
        <td>080432123456</td>
        <td class="Order_line-id">ABC123</td>
        <td class="Order_line-title">Sample Bourbon</td>
        <td class="Order_line-shipment-date">04/25/2026</td>
        <td class="Order_line-price">$24.99</td>
        <td class="Order_line-discount">$0.00</td>
        <td class="Order_line-qty">2</td>
        <td>12</td>
        <td class="Order_line-uom">Case</td>
        <td class="Order_line-qty-outstanding">0</td>
        <td class="Order_line-total">$599.76</td>
      </tr>
    </tbody>
  </table>
  <table class="Order_totals-table">
    <tr><td class="Order_totals-name">Subtotal</td><td class="Order_totals-value">$599.76</td></tr>
    <tr><td class="Order_totals-name">Total incl. tax</td><td class="Order_totals-value">$641.74</td></tr>
  </table>
`;

const pickupHtml = `
  <dl class="Order_general-info">
    <dt>Document no.</dt><dd>DOC-1002</dd>
    <dt>Order no.</dt><dd>ORD-2002</dd>
    <dt>Shipping method</dt><dd>Pick Up in store</dd>
    <dt>Shipment date</dt><dd>04/26/2026</dd>
  </dl>
  <table>
    <thead>
      <tr>
        <th>UPC</th><th>Item No.</th><th>Title</th><th>Shipment date</th><th>Price</th><th>Discount</th><th>Qty</th><th>Pack Size</th><th>UOM</th><th>Qty Outstanding</th><th>Total</th>
      </tr>
    </thead>
    <tbody>
      <tr class="Order_product-line">
        <td>N/A</td>
        <td class="Order_line-id">MANUAL1</td>
        <td class="Order_line-title">Allocated Vodka</td>
        <td class="Order_line-shipment-date">04/26/2026</td>
        <td class="Order_line-price">$10.00</td>
        <td class="Order_line-discount">N/A</td>
        <td class="Order_line-qty">6</td>
        <td>N/A</td>
        <td class="Order_line-uom">Bottles</td>
        <td class="Order_line-qty-outstanding">1</td>
        <td class="Order_line-total">$60.00</td>
      </tr>
      <tr class="Order_product-line">
        <td>096749999999</td>
        <td class="Order_line-id">CASE1</td>
        <td class="Order_line-title">Missing Pack Rum</td>
        <td class="Order_line-shipment-date">04/26/2026</td>
        <td class="Order_line-price">$18.00</td>
        <td class="Order_line-discount">$0.00</td>
        <td class="Order_line-qty">1</td>
        <td>N/A</td>
        <td class="Order_line-uom">Case</td>
        <td class="Order_line-qty-outstanding">0</td>
        <td class="Order_line-total">$216.00</td>
      </tr>
    </tbody>
  </table>
`;

describe('parseAlabamaOrderHtml', () => {
  it('parses direct delivery case quantities into bottles', () => {
    const parsed = parseAlabamaOrderHtml(directDeliveryHtml);

    expect(parsed.document_no).toBe('DOC-1001');
    expect(parsed.order_no).toBe('ORD-2001');
    expect(parsed.shipping_method).toBe('Direct Delivery');
    expect(parsed.shipment_date).toBe('2026-04-25');
    expect(parsed.total).toBe(641.74);
    expect(parsed.lines[0]).toMatchObject({
      upc: '080432123456',
      item_no: 'ABC123',
      ordered_qty: 2,
      uom: 'Case',
      pack_size: 12,
      ordered_bottles: 24,
      line_total: 599.76,
    });
  });

  it('parses pickup bottle lines and flags missing case pack size', () => {
    const parsed = parseAlabamaOrderHtml(pickupHtml);

    expect(parsed.shipping_method).toBe('Pick Up in store');
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[0]).toMatchObject({
      upc: 'N/A',
      item_no: 'MANUAL1',
      uom: 'Bottles',
      ordered_bottles: 6,
      outstanding_qty: 1,
    });
    expect(parsed.lines[1]).toMatchObject({
      upc: '096749999999',
      item_no: 'CASE1',
      uom: 'Case',
      pack_size: null,
      ordered_bottles: null,
    });
  });

  it('parses inline shipping method and location labels with colons', () => {
    const parsed = parseAlabamaOrderHtml(`
      <div class="Order_general-info">
        <div>Document no.: DOC-1003</div>
        <div>Order no.: ORD-2003</div>
        <div>Shipping method :Pick Up in store</div>
        <div>Location: Store 236</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>UPC</th><th>Item No.</th><th>Title</th><th>Shipment date</th><th>Price</th><th>Discount</th><th>Qty</th><th>Pack Size</th><th>UOM</th><th>Qty Outstanding</th><th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr class="Order_product-line">
            <td>012345678905</td>
            <td class="Order_line-id">INLINE1</td>
            <td class="Order_line-title">Inline Label Whiskey</td>
            <td class="Order_line-shipment-date"></td>
            <td class="Order_line-price">$1.00</td>
            <td class="Order_line-discount">$0.00</td>
            <td class="Order_line-qty">1</td>
            <td>1</td>
            <td class="Order_line-uom">Bottles</td>
            <td class="Order_line-qty-outstanding">0</td>
            <td class="Order_line-total">$1.00</td>
          </tr>
        </tbody>
      </table>
    `);

    expect(parsed.shipping_method).toBe('Pick Up in store');
    expect(parsed.location_code).toBe('Store 236');
  });
});
