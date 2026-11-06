-- Prio-markerade varor syns på Idag
alter table public.shopping_items add column if not exists prio boolean not null default false;
