-- Run in Supabase SQL Editor: bucket for PO PDFs (safe to re-run)

insert into storage.buckets (id, name, public)
values ('po-documents', 'po-documents', true)
on conflict (id) do update set public = true;

drop policy if exists "public_read_po" on storage.objects;
drop policy if exists "service_upload_po" on storage.objects;

create policy "public_read_po" on storage.objects
  for select using (bucket_id = 'po-documents');

create policy "service_upload_po" on storage.objects
  for all using (bucket_id = 'po-documents')
  with check (bucket_id = 'po-documents');
