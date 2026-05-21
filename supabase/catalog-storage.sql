-- Run in Supabase SQL Editor (optional — uploads are parsed in memory; bucket for future use)

insert into storage.buckets (id, name, public)
values ('catalog-uploads', 'catalog-uploads', false)
on conflict (id) do nothing;

drop policy if exists "service_catalog_upload" on storage.objects;

create policy "service_catalog_upload" on storage.objects
  for all using (bucket_id = 'catalog-uploads')
  with check (bucket_id = 'catalog-uploads');
