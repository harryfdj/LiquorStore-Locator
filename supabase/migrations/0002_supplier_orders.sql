create table if not exists public.supplier_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  document_no text not null,
  order_no text not null,
  shipping_method text not null default '',
  shipment_date date,
  order_date date,
  document_date date,
  location_code text not null default '',
  payment_status text not null default '',
  payment_method text not null default '',
  subtotal numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  raw_html text not null default '',
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'finalized')),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, document_no, order_no)
);

create table if not exists public.supplier_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.supplier_orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  line_index integer not null,
  upc text not null default '',
  item_no text not null default '',
  title text not null,
  shipment_date date,
  price numeric(12, 2) not null default 0,
  discount text not null default '',
  ordered_qty numeric(12, 2) not null default 0,
  uom text not null default '',
  pack_size integer,
  ordered_bottles integer,
  outstanding_qty numeric(12, 2) not null default 0,
  line_total numeric(14, 2) not null default 0,
  product_sku text,
  product_name text,
  product_upc text,
  inventory_stock_snapshot integer,
  inventory_pack_snapshot text,
  received_bottles integer,
  final_rack_count integer,
  status text not null default 'pending' check (
    status in ('pending', 'matched', 'mismatched', 'manual_review')
  ),
  issue_type text not null default 'pending' check (
    issue_type in ('pending', 'matched', 'short_received', 'extra_received', 'rack_mismatch', 'manual_review')
  ),
  notes text not null default '',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, line_index)
);

create index if not exists supplier_orders_store_created_idx on public.supplier_orders (store_id, created_at desc);
create index if not exists supplier_orders_store_status_idx on public.supplier_orders (store_id, status, created_at desc);
create index if not exists supplier_order_lines_order_idx on public.supplier_order_lines (order_id, line_index);
create index if not exists supplier_order_lines_store_upc_idx on public.supplier_order_lines (store_id, upc);
create index if not exists supplier_order_lines_store_product_idx on public.supplier_order_lines (store_id, product_sku);

drop trigger if exists supplier_orders_set_updated_at on public.supplier_orders;
create trigger supplier_orders_set_updated_at
  before update on public.supplier_orders
  for each row execute function public.set_updated_at();

drop trigger if exists supplier_order_lines_set_updated_at on public.supplier_order_lines;
create trigger supplier_order_lines_set_updated_at
  before update on public.supplier_order_lines
  for each row execute function public.set_updated_at();

alter table public.supplier_orders enable row level security;
alter table public.supplier_order_lines enable row level security;

create policy "Admins can read supplier orders"
  on public.supplier_orders for select
  using (
    exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = auth.uid()
    )
  );

create policy "Admins can read supplier order lines"
  on public.supplier_order_lines for select
  using (
    exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = auth.uid()
    )
  );
