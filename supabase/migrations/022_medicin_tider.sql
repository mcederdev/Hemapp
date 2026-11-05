-- Medicin med tider: times = [{ "time": "08:00", "amount": 2 }, ...]. Ersätter morgon/kväll (021).
-- Avbockning per tid i medicine_takes (medicine_doses från 021 används inte längre).
alter table public.medicines add column if not exists times jsonb not null default '[]'::jsonb;

update public.medicines set times = (
  case
    when coalesce(dose_morning, 0) > 0 or coalesce(dose_evening, 0) > 0 then
      (case when coalesce(dose_morning, 0) > 0 then jsonb_build_array(jsonb_build_object('time', '08:00', 'amount', dose_morning)) else '[]'::jsonb end)
      || (case when coalesce(dose_evening, 0) > 0 then jsonb_build_array(jsonb_build_object('time', '20:00', 'amount', dose_evening)) else '[]'::jsonb end)
    when doses_per_day >= 3 then jsonb_build_array(jsonb_build_object('time', '08:00', 'amount', dose), jsonb_build_object('time', '14:00', 'amount', dose), jsonb_build_object('time', '20:00', 'amount', dose))
    when doses_per_day >= 2 then jsonb_build_array(jsonb_build_object('time', '08:00', 'amount', dose), jsonb_build_object('time', '20:00', 'amount', dose))
    else jsonb_build_array(jsonb_build_object('time', '08:00', 'amount', dose))
  end)
where times = '[]'::jsonb;

create table if not exists public.medicine_takes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  day date not null,
  at_time text not null,
  taken_by uuid references public.members(id) on delete set null,
  taken_at timestamptz not null default now(),
  unique (medicine_id, day, at_time)
);
alter table public.medicine_takes enable row level security;
create policy "tagningar for synliga mediciner" on public.medicine_takes for all to authenticated
  using (medicine_id in (select id from public.medicines))
  with check (medicine_id in (select id from public.medicines) and household_id in (select my_household_ids()));
alter publication supabase_realtime add table public.medicine_takes;
