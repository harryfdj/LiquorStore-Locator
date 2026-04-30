alter table public.supplier_order_lines add column if not exists is_auto_matched boolean not null default false;
alter table public.supplier_order_lines add column if not exists product_location text;
