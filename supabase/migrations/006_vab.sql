-- VAB och sjukdagar
create table if not exists vab_days (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  child_id uuid references members(id) on delete set null,
  parent_id uuid references members(id) on delete set null,
  day date not null,
  full_day boolean not null default true,
  start_time time,            -- förälderns arbetstid som man var borta
  end_time time,
  hours numeric,              -- frånvarotimmar (räknas från tiderna men kan ändras)
  illness text,
  temperature numeric,
  note text,
  event_id uuid references events(id) on delete set null,
  reported boolean not null default false,
  reported_at timestamptz,
  created_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists vab_days_household_day on vab_days (household_id, day);
alter table vab_days enable row level security;
create policy "eget hushåll" on vab_days for all
  using (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));
alter publication supabase_realtime add table vab_days;

-- Veckovis påminnelse om oanmäld VAB
alter table households add column if not exists last_vab_push date;
