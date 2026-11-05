-- Varor per rätt, årliga påminnelser, födelsedagar och lappar
create table if not exists dish_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  dish text not null,
  items text[] not null default '{}',
  unique (household_id, dish)
);
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  emoji text not null default '🔔',
  due_date date not null,
  repeat_months int not null default 12,     -- 0 = en gång
  remind_days int not null default 14,
  note text,
  notified_for date,                          -- vilket förfallodatum vi redan har påmint om
  created_at timestamptz not null default now()
);
create table if not exists birthdays (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  day date not null,                          -- födelsedag (året används för ålder om det är känt)
  year_known boolean not null default true,
  gift_ideas text,
  remind_days int not null default 14,
  notified_year int,
  created_at timestamptz not null default now()
);
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  text text not null,
  color text not null default 'yellow',
  author uuid references members(id) on delete set null,
  until date,
  created_at timestamptz not null default now()
);
do $$
declare t text;
begin
  foreach t in array array['dish_items','reminders','birthdays','notes'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "eget hushåll" on %I for all
         using (household_id in (select my_household_ids()))
         with check (household_id in (select my_household_ids()))', t);
  end loop;
end $$;
alter publication supabase_realtime add table dish_items, reminders, birthdays, notes;
alter table households add column if not exists last_yearly_push date;
