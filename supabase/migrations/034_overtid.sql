-- Övertid: privat per person (bara den inloggade ser sin egen)
create table if not exists overtime (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  day date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  event_id uuid references events(id) on delete set null,
  free_day boolean not null default false,
  note text,
  reported_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists overtime_settings (
  member_id uuid primary key references members(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  salary numeric,
  div_day numeric not null default 94,
  div_other numeric not null default 72,
  last_reminder text,
  created_at timestamptz not null default now()
);
alter table overtime enable row level security;
alter table overtime_settings enable row level security;
create policy "egen övertid" on overtime for all
  using (member_id in (select id from members where user_id = auth.uid()))
  with check (member_id in (select id from members where user_id = auth.uid()));
create policy "egna övertidsinställningar" on overtime_settings for all
  using (member_id in (select id from members where user_id = auth.uid()))
  with check (member_id in (select id from members where user_id = auth.uid()));
create index if not exists overtime_member_day on overtime(member_id, day);
alter publication supabase_realtime add table overtime;
