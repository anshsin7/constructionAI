-- Run in Supabase SQL Editor (Step 1)

create extension if not exists "pgcrypto";

create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
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
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  requestor_id uuid not null references users(id),
  product_id uuid not null references products(id),
  quantity integer not null check (quantity > 0),
  total_price numeric not null,
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'approved', 'rejected', 'po_sent', 'confirmed', 'cancelled')),
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
