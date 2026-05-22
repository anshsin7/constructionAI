-- Run in Supabase SQL Editor (Step 1)

create extension if not exists "pgcrypto";

create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  delivery_address text,
  batch_send_time time,
  last_batch_sent_date date,
  total_budget numeric not null default 0,
  spent numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  role text not null check (role in ('worker', 'approver', 'procurement')),
  site_id uuid references sites(id),
  budget_limit numeric not null default 0,
  manager_id uuid references users(id),
  created_at timestamptz not null default now()
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  contract_ref text,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text,
  unit text not null default 'piece',
  unit_price numeric not null,
  supplier_id uuid references suppliers(id),
  popularity_score integer not null default 0,
  image_url text,
  sku text,
  is_active boolean not null default true,
  search_text text,
  keywords jsonb not null default '[]'::jsonb,
  size_spec text,
  created_at timestamptz not null default now()
);

create table if not exists product_aliases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  alias text not null,
  source text not null default 'import',
  created_at timestamptz not null default now()
);

create table if not exists catalog_uploads (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_type text not null check (file_type in ('csv', 'xlsx', 'pdf')),
  source_type text not null check (source_type in ('contract', 'price_list', 'quote')),
  supplier_name text,
  status text not null default 'preview'
    check (status in ('preview', 'committed', 'failed')),
  uploaded_by uuid references users(id),
  row_count integer not null default 0,
  skipped_no_price integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  committed_at timestamptz
);

create table if not exists catalog_upload_rows (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references catalog_uploads(id) on delete cascade,
  row_index integer not null,
  name text not null,
  category text not null,
  unit text not null default 'piece',
  unit_price numeric not null,
  sku text,
  supplier_name text,
  keywords jsonb not null default '[]'::jsonb,
  aliases jsonb not null default '[]'::jsonb,
  size_spec text,
  match_product_id uuid references products(id),
  action text not null default 'create' check (action in ('create', 'update', 'skip')),
  confidence text,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  requestor_id uuid not null references users(id),
  product_id uuid not null references products(id),
  quantity integer not null check (quantity > 0),
  total_price numeric not null,
  status text not null default 'pending_approval'
    check (status in (
      'pending_approval', 'approved', 'rejected', 'po_sent', 'confirmed', 'cancelled', 'queued'
    )),
  is_urgent boolean not null default true,
  batch_po_key text,
  approver_id uuid references users(id),
  approval_note text,
  site_id uuid references sites(id),
  input_method text check (input_method in ('image', 'voice', 'text')),
  ai_classification jsonb,
  po_pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists uploaded_documents (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_url text not null,
  file_type text check (file_type in ('csv', 'xlsx', 'pdf')),
  processed boolean not null default false,
  uploaded_by uuid references users(id),
  created_at timestamptz not null default now()
);
