-- Run in Supabase SQL Editor after schema.sql + seed.sql

alter table products add column if not exists sku text;
alter table products add column if not exists is_active boolean not null default true;
alter table products add column if not exists search_text text;
alter table products add column if not exists keywords jsonb not null default '[]'::jsonb;
alter table products add column if not exists size_spec text;

create table if not exists product_aliases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  alias text not null,
  source text not null default 'import',
  created_at timestamptz not null default now()
);

create index if not exists idx_product_aliases_product on product_aliases(product_id);
create index if not exists idx_products_active_pop on products(is_active, popularity_score desc);
create index if not exists idx_products_search on products using gin(to_tsvector('english', coalesce(search_text, '')));

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

create index if not exists idx_catalog_upload_rows_upload on catalog_upload_rows(upload_id);

alter table product_aliases disable row level security;
alter table catalog_uploads disable row level security;
alter table catalog_upload_rows disable row level security;

-- Backfill search_text for existing seed products
update products set
  search_text = lower(trim(coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, ''))),
  keywords = case id::text
    when '44444444-4444-4444-4444-444444444401' then '["helmet","hard hat","ppe","safety","en397"]'::jsonb
    when '44444444-4444-4444-4444-444444444402' then '["goggles","safety glasses","ppe","eye protection"]'::jsonb
    when '44444444-4444-4444-4444-444444444403' then '["screw","anchor","concrete screw","fastener","7.5x92","frame anchor"]'::jsonb
    when '44444444-4444-4444-4444-444444444404' then '["drill","cordless","power tool","18v","driver"]'::jsonb
    when '44444444-4444-4444-4444-444444444405' then '["hammer","claw hammer","hand tool","500g"]'::jsonb
    else keywords
  end,
  size_spec = case id::text
    when '44444444-4444-4444-4444-444444444403' then '7.5x92mm'
    else size_spec
  end
where search_text is null or search_text = '';
