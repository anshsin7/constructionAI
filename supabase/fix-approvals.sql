-- Run in Supabase SQL Editor if orders / approvals still empty in the app

-- 1) Ensure Marco reports to Sara
update users
set manager_id = '22222222-2222-2222-2222-222222222202'
where id = '22222222-2222-2222-2222-222222222201';

-- 2) Backfill approver on pending orders
update orders
set approver_id = '22222222-2222-2222-2222-222222222202'
where status = 'pending_approval'
  and requestor_id = '22222222-2222-2222-2222-222222222201'
  and (approver_id is null or approver_id != '22222222-2222-2222-2222-222222222202');

-- 3) Supplier email stays null — PO emails go to PO_TEST_EMAIL in backend .env only
update suppliers set email = null where id = '33333333-3333-3333-3333-333333333301';

-- 4) Hackathon: disable RLS so the backend can read/write reliably
alter table sites disable row level security;
alter table users disable row level security;
alter table suppliers disable row level security;
alter table products disable row level security;
alter table orders disable row level security;
