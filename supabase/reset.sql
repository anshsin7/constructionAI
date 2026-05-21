-- Run this FIRST in Supabase SQL Editor to wipe all app tables and start fresh.
-- Deleting saved queries in the sidebar is optional (cosmetic only).

drop table if exists orders cascade;
drop table if exists uploaded_documents cascade;
drop table if exists products cascade;
drop table if exists users cascade;
drop table if exists suppliers cascade;
drop table if exists sites cascade;
