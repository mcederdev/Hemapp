-- Engångsflytt av bytet: egna klockslag för avvikelsen (null = vanliga bytestiden)
alter table public.custody_exceptions add column if not exists from_time text, add column if not exists to_time text;
