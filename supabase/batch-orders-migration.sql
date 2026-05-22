-- Non-urgent order batching: run in Supabase SQL Editor after schema.sql

alter table sites add column if not exists batch_send_time time;
alter table sites add column if not exists last_batch_sent_date date;

alter table orders add column if not exists is_urgent boolean not null default true;
alter table orders add column if not exists batch_po_key text;

alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check check (
  status in (
    'pending_approval',
    'approved',
    'rejected',
    'po_sent',
    'confirmed',
    'cancelled',
    'queued'
  )
);

update sites
set batch_send_time = coalesce(batch_send_time, '17:00:00'::time)
where id = '11111111-1111-1111-1111-111111111101';
