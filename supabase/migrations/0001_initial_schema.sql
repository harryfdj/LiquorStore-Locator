create extension if not exists pgcrypto;

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  password_hash text not null,
  csv_mapping jsonb not null default '{}'::jsonb,
  lat double precision,
  lng double precision,
  radius_miles numeric(8, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  sku text not null,
  name text not null,
  size text not null default '',
  pack text not null default '',
  price numeric(12, 2) not null default 0,
  cost numeric(12, 2) not null default 0,
  stock integer not null default 0,
  location text not null default '',
  image_url text not null default '',
  category text not null default '',
  mainupc text not null default '',
  depname text not null default '',
  alt_upcs text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, sku)
);

create table if not exists public.verification_reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  total_scanned integer not null default 0,
  total_matched integer not null default 0,
  total_mismatched integer not null default 0,
  total_value_cost numeric(14, 2) not null default 0,
  total_value_retail numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_verifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  report_id uuid references public.verification_reports(id) on delete set null,
  sku text not null,
  mainupc text not null default '',
  name text not null,
  system_stock integer not null default 0,
  actual_stock integer not null default 0,
  status text not null check (status in ('matched', 'mismatched')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists stock_verifications_active_sku_idx
  on public.stock_verifications (store_id, sku)
  where report_id is null;

create index if not exists products_store_name_idx on public.products (store_id, name);
create index if not exists products_store_depname_idx on public.products (store_id, depname);
create index if not exists products_store_mainupc_idx on public.products (store_id, mainupc);
create index if not exists stock_verifications_store_report_idx on public.stock_verifications (store_id, report_id, created_at desc);
create index if not exists verification_reports_store_created_idx on public.verification_reports (store_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists stock_verifications_set_updated_at on public.stock_verifications;
create trigger stock_verifications_set_updated_at
  before update on public.stock_verifications
  for each row execute function public.set_updated_at();

alter table public.admin_profiles enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.stock_verifications enable row level security;
alter table public.verification_reports enable row level security;

create policy "Admins can read admin profiles"
  on public.admin_profiles for select
  using (auth.uid() = user_id);

create policy "Admins can read stores"
  on public.stores for select
  using (
    exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = auth.uid()
    )
  );

create policy "Admins can read products"
  on public.products for select
  using (
    exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = auth.uid()
    )
  );

create policy "Admins can read verifications"
  on public.stock_verifications for select
  using (
    exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = auth.uid()
    )
  );

create policy "Admins can read reports"
  on public.verification_reports for select
  using (
    exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
