-- Hemappen: databasschema för Supabase
-- Kör hela filen en gång i Supabase > SQL Editor.

create extension if not exists pgcrypto;

-- Hushåll ---------------------------------------------------------------
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_at timestamptz not null default now()
);

-- Familjemedlemmar. Föräldrar har user_id (loggar in), barn har inget.
create table members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  role text not null default 'parent' check (role in ('parent', 'child')),
  color text not null default '#4f7cff',
  monthly_income numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Inköpslista
create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- Att göra / sysslor
create table chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  assigned_to uuid references members(id) on delete set null,
  due_date date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- Egna "vanliga sysslor" utöver de inbyggda
create table chore_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

-- Kalender
create table events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text,
  member_id uuid references members(id) on delete set null,
  ics_uid text,
  created_at timestamptz not null default now(),
  unique (household_id, ics_uid)
);

-- Egna rätter (de vanliga finns inbyggda i appen)
create table dishes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  category text,
  created_at timestamptz not null default now()
);

-- Hushållets räkningar
create table bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  amount numeric not null default 0,
  paid_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Behörighet ------------------------------------------------------------
create or replace function my_household_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select household_id from members where user_id = auth.uid()
$$;

alter table households enable row level security;
alter table members enable row level security;
alter table shopping_items enable row level security;
alter table chores enable row level security;
alter table chore_templates enable row level security;
alter table events enable row level security;
alter table dishes enable row level security;
alter table bills enable row level security;

create policy "läs eget hushåll" on households for select
  using (id in (select my_household_ids()));
create policy "ändra eget hushåll" on households for update
  using (id in (select my_household_ids()));

do $$
declare t text;
begin
  foreach t in array array['members','shopping_items','chores','chore_templates','events','dishes','bills'] loop
    execute format(
      'create policy "eget hushåll" on %I for all
         using (household_id in (select my_household_ids()))
         with check (household_id in (select my_household_ids()))', t);
  end loop;
end $$;

-- Skapa hushåll (första föräldern)
create or replace function create_household(household_name text, my_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'Inte inloggad'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'Du tillhör redan ett hushåll';
  end if;
  insert into households (name) values (household_name) returning id into hid;
  insert into members (household_id, user_id, name, role) values (hid, auth.uid(), my_name, 'parent');
  return hid;
end $$;

-- Gå med i hushåll med inbjudningskod (andra föräldern)
create or replace function join_household(code text, my_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'Inte inloggad'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'Du tillhör redan ett hushåll';
  end if;
  select id into hid from households where invite_code = upper(trim(code));
  if hid is null then raise exception 'Fel kod'; end if;
  insert into members (household_id, user_id, name, role, color)
    values (hid, auth.uid(), my_name, 'parent', '#e0567a');
  return hid;
end $$;

-- Live-synk
alter publication supabase_realtime add table
  members, shopping_items, chores, chore_templates, events, dishes, bills;

-- Bara inloggade får anropa funktionerna
revoke execute on function my_household_ids() from public, anon;
revoke execute on function create_household(text, text) from public, anon;
revoke execute on function join_household(text, text) from public, anon;
grant execute on function my_household_ids() to authenticated;
grant execute on function create_household(text, text) to authenticated;
grant execute on function join_household(text, text) to authenticated;
