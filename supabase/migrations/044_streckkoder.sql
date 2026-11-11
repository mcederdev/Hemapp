-- Streckkoder som familjen har skannat: koden och vad varan heter hos oss.
-- Nästa gång samma vara skannas känns den igen direkt, även om den saknas i Open Food Facts.
-- Bara en ny tabell, så appen som redan är ute påverkas inte.
create table if not exists public.barcodes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  code text not null,
  name text not null,
  place text,
  qty text,
  created_at timestamptz not null default now(),
  unique (household_id, code)
);
alter table public.barcodes enable row level security;
create policy "egna streckkoder" on public.barcodes for all
  using (household_id in (select my_household_ids())) with check (household_id in (select my_household_ids()));
alter publication supabase_realtime add table public.barcodes;
