-- Ordning på familjemedlemmarna (lista med member-id), styr familjeremsan, Idag och kalenderns dagsvy
alter table public.households add column if not exists member_order jsonb not null default '[]'::jsonb;
