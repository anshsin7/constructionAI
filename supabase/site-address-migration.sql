-- Run in Supabase SQL Editor if sites already exist without delivery_address
alter table sites add column if not exists delivery_address text;

update sites
set delivery_address = 'Pestalozzistrasse 11, 8032 Zürich Schweiz';
