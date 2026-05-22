-- Run after schema.sql in Supabase SQL Editor
-- Demo IDs are fixed so curl examples in the README stay stable

-- Hackathon: disable RLS so the Node backend can read/write with the anon key
alter table sites disable row level security;
alter table users disable row level security;
alter table suppliers disable row level security;
alter table products disable row level security;
alter table orders disable row level security;
alter table product_aliases disable row level security;
alter table catalog_uploads disable row level security;
alter table catalog_upload_rows disable row level security;

insert into sites (id, name, location, delivery_address, batch_send_time, total_budget, spent) values
  (
    '11111111-1111-1111-1111-111111111101',
    'Zürich HB Tower',
    'Zürich',
    'Pestalozzistrasse 11, 8032 Zürich Schweiz',
    '17:00:00',
    50000,
    1200
  )
on conflict (id) do update set
  delivery_address = excluded.delivery_address,
  location = excluded.location,
  batch_send_time = excluded.batch_send_time;

-- Sara first (Marco references her as manager)
insert into users (id, name, email, role, site_id, budget_limit, manager_id) values
  ('22222222-2222-2222-2222-222222222203', 'Procurement', 'procurement@demo.ch', 'procurement', null, 0, null)
on conflict (id) do update set name = excluded.name, role = excluded.role;

insert into users (id, name, email, role, site_id, budget_limit, manager_id) values
  ('22222222-2222-2222-2222-222222222202', 'Sara', 'sara@demo.ch', 'approver', '11111111-1111-1111-1111-111111111101', 500, null)
on conflict (id) do update set
  name = excluded.name,
  role = excluded.role,
  site_id = excluded.site_id,
  budget_limit = excluded.budget_limit,
  manager_id = excluded.manager_id;

insert into users (id, name, email, role, site_id, budget_limit, manager_id) values
  ('22222222-2222-2222-2222-222222222201', 'Marco', 'marco@demo.ch', 'worker', '11111111-1111-1111-1111-111111111101', 50, '22222222-2222-2222-2222-222222222202')
on conflict (id) do update set
  name = excluded.name,
  role = excluded.role,
  site_id = excluded.site_id,
  budget_limit = excluded.budget_limit,
  manager_id = excluded.manager_id;

insert into suppliers (id, name, email, contract_ref) values
  ('33333333-3333-3333-3333-333333333301', 'BauSupply AG', null, 'CTR-2024-001')
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  contract_ref = excluded.contract_ref;

insert into products (id, name, category, description, unit, unit_price, supplier_id, popularity_score) values
  ('44444444-4444-4444-4444-444444444401', 'Hard Hat EN397', 'PPE', 'Industrial safety helmet', 'piece', 18.50, '33333333-3333-3333-3333-333333333301', 12),
  ('44444444-4444-4444-4444-444444444402', 'Safety Goggles Clear', 'PPE', 'Anti-fog safety goggles', 'piece', 9.90, '33333333-3333-3333-3333-333333333301', 8),
  ('44444444-4444-4444-4444-444444444403', 'Concrete Screw 7.5x92', 'Fasteners', 'Frame anchor for concrete', 'box', 24.00, '33333333-3333-3333-3333-333333333301', 15),
  ('44444444-4444-4444-4444-444444444404', 'Cordless Drill 18V', 'Power Tools', 'Brushless drill driver kit', 'piece', 189.00, '33333333-3333-3333-3333-333333333301', 6),
  ('44444444-4444-4444-4444-444444444405', 'Claw Hammer 500g', 'Hand Tools', 'Fiberglass handle hammer', 'piece', 14.50, '33333333-3333-3333-3333-333333333301', 10)
on conflict (id) do nothing;
