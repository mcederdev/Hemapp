-- Version 2: flera inköpslistor, varukatalog, veckomeny, återkommande sysslor,
-- stjärnor/veckopeng, ekonomihistorik, Swish och pushnotiser.

-- Hushållsinställningar
alter table households add column if not exists kr_per_star numeric not null default 5;
alter table households add column if not exists morning_push_hour int not null default 7;

-- Medlemmar: telefon för Swish
alter table members add column if not exists phone text;

-- Inköpslistor ----------------------------------------------------------
create table shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  for_date date,
  is_default boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index one_default_list on shopping_lists (household_id) where is_default;

alter table shopping_items add column if not exists list_id uuid references shopping_lists(id) on delete cascade;
alter table shopping_items add column if not exists added_by uuid references members(id) on delete set null;
alter table shopping_items add column if not exists section text;

-- Varukatalog: allt ni lagt till någon gång, med avdelning och hur ofta.
-- Används för förslag och "Slut hemma".
create table item_catalog (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  section text,
  times_added int not null default 0,
  is_staple boolean not null default false,
  last_added_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index item_catalog_name on item_catalog (household_id, lower(name));

-- Lägg till i katalogen automatiskt när en vara läggs till
create or replace function bump_catalog() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into item_catalog (household_id, name, section, times_added, last_added_at)
  values (new.household_id, new.name, new.section, 1, now())
  on conflict (household_id, lower(name)) do update
    set times_added = item_catalog.times_added + 1,
        last_added_at = now(),
        section = coalesce(excluded.section, item_catalog.section);
  return new;
end $$;
create trigger shopping_items_catalog after insert on shopping_items
  for each row execute function bump_catalog();

-- Standardlista för befintliga hushåll + flytta befintliga varor dit
insert into shopping_lists (household_id, name, is_default)
  select id, 'Veckohandling', true from households;
update shopping_items i set list_id = l.id
  from shopping_lists l where l.household_id = i.household_id and l.is_default and i.list_id is null;

-- Nya hushåll får en standardlista
create or replace function create_default_list() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into shopping_lists (household_id, name, is_default) values (new.id, 'Veckohandling', true);
  return new;
end $$;
create trigger households_default_list after insert on households
  for each row execute function create_default_list();

-- Sysslor: återkommande och stjärnor -------------------------------------
alter table chores add column if not exists repeat_every int;          -- t.ex. 1, 2
alter table chores add column if not exists repeat_unit text check (repeat_unit in ('day','week','month'));
alter table chores add column if not exists stars int not null default 0;
alter table chores add column if not exists done_at timestamptz;
alter table chores add column if not exists reminded_at timestamptz;

-- Kalender: återkommande händelser och påminnelser
alter table events add column if not exists rrule text;
alter table events add column if not exists remind_minutes int default 30;
alter table events add column if not exists reminded_at timestamptz;

-- Veckomeny -------------------------------------------------------------
create table meal_plan (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  day date not null,
  dish text not null,
  created_at timestamptz not null default now(),
  unique (household_id, day)
);

-- Ekonomi: fasta och engångsräkningar, historik ----------------------------
alter table bills add column if not exists kind text not null default 'fixed' check (kind in ('fixed','once'));
alter table bills add column if not exists month date;   -- första dagen i månaden, för engångsräkningar

create table settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  month date not null,
  from_member uuid references members(id) on delete set null,
  to_member uuid references members(id) on delete set null,
  amount numeric not null,
  total_bills numeric not null default 0,
  paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, month)
);

-- Pushnotiser -------------------------------------------------------------
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Behörighet för nya tabeller
alter table shopping_lists enable row level security;
alter table item_catalog enable row level security;
alter table meal_plan enable row level security;
alter table settlements enable row level security;
alter table push_subscriptions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['shopping_lists','item_catalog','meal_plan','settlements','push_subscriptions'] loop
    execute format(
      'create policy "eget hushåll" on %I for all
         using (household_id in (select my_household_ids()))
         with check (household_id in (select my_household_ids()))', t);
  end loop;
end $$;

revoke execute on function bump_catalog() from public, anon, authenticated;
revoke execute on function create_default_list() from public, anon, authenticated;

alter publication supabase_realtime add table shopping_lists, item_catalog, meal_plan, settlements, households;
