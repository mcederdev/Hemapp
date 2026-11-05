-- Lämna/hämta: "Båda" föräldrarna tillsammans
alter table public.pickups add column if not exists both_parents boolean not null default false;
