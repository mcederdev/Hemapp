-- Medicin morgon och kväll: dos per tillfälle och avbockning (syns för båda föräldrarna)
alter table public.medicines add column if not exists dose_morning numeric;
alter table public.medicines add column if not exists dose_evening numeric;

create table if not exists public.medicine_doses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  day date not null,
  slot text not null check (slot in ('morgon', 'kvall')),
  taken_by uuid references public.members(id) on delete set null,
  taken_at timestamptz not null default now(),
  unique (medicine_id, day, slot)
);
create index if not exists medicine_doses_med_day on public.medicine_doses (medicine_id, day);
alter table public.medicine_doses enable row level security;
-- Samma som medicinen: eget hushåll eller delat barn (underfrågan går genom medicines egen RLS)
create policy "doser for synliga mediciner" on public.medicine_doses for all to authenticated
  using (medicine_id in (select id from public.medicines))
  with check (medicine_id in (select id from public.medicines) and household_id in (select my_household_ids()));
alter publication supabase_realtime add table public.medicine_doses;
