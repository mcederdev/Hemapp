-- Medicin: dölj på Idag per hushåll (lista med hushålls-id), så båda hemmen väljer själva
alter table public.medicines add column if not exists hide_today jsonb not null default '[]'::jsonb;
