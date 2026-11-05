-- Delad vårdnad: koppla ihop två hushåll, dela barnets kalender, VAB, schema och bil

create table if not exists household_links (
  id uuid primary key default gen_random_uuid(),
  a uuid not null references households(id) on delete cascade,  -- hushållet som bjöd in
  b uuid not null references households(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (a, b)
);
create table if not exists link_invites (
  code text primary key,
  household_id uuid not null references households(id) on delete cascade,
  child_ids uuid[] not null,
  created_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create table if not exists shared_children (
  link_id uuid not null references household_links(id) on delete cascade,
  child_id uuid not null references members(id) on delete cascade,
  primary key (link_id, child_id)
);

-- Hjälpfunktioner för behörighet
create or replace function my_link_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select l.id from household_links l where l.a in (select my_household_ids()) or l.b in (select my_household_ids())
$$;
create or replace function my_shared_child_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select s.child_id from shared_children s where s.link_id in (select my_link_ids())
$$;
create or replace function my_linked_household_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select case when l.a in (select my_household_ids()) then l.b else l.a end
  from household_links l where l.id in (select my_link_ids())
$$;

alter table household_links enable row level security;
alter table link_invites enable row level security;
alter table shared_children enable row level security;
create policy "mina kopplingar" on household_links for select using (id in (select my_link_ids()));
create policy "mina kopplingar tas bort" on household_links for delete using (id in (select my_link_ids()));
create policy "egna inbjudningar" on link_invites for all
  using (household_id in (select my_household_ids())) with check (household_id in (select my_household_ids()));
create policy "delade barn" on shared_children for select using (link_id in (select my_link_ids()));

-- Delat barn: syns i andra hushållets medlemslista, kalender och VAB
create policy "delat barn syns" on members for select using (id in (select my_shared_child_ids()));
create policy "delat barns kalender" on events for all
  using (member_id in (select my_shared_child_ids())) with check (member_id in (select my_shared_child_ids()));
create policy "delat barns vab" on vab_days for all
  using (kind = 'vab' and child_id in (select my_shared_child_ids()))
  with check (kind = 'vab' and child_id in (select my_shared_child_ids()));

-- Växelvis boende
create table if not exists custody (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  child_id uuid not null references members(id) on delete cascade,
  link_id uuid references household_links(id) on delete set null,
  other_label text not null default 'andra föräldern',
  anchor date not null,              -- en dag då barnet kommer till household_id
  every_days int not null default 7, -- hur länge varje period är
  handover_time time not null default '18:00',
  notified_for date,
  created_at timestamptz not null default now(),
  unique (child_id)
);
alter table custody enable row level security;
create policy "eget eller kopplat schema" on custody for all
  using (household_id in (select my_household_ids()) or link_id in (select my_link_ids()))
  with check (household_id in (select my_household_ids()) or link_id in (select my_link_ids()));

-- Bil som delas
create table if not exists cars (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  link_id uuid references household_links(id) on delete set null,
  name text not null default 'Bilen',
  reg_nr text,
  owner_share numeric not null default 50,  -- procent som ägarhushållet betalar av delade kostnader
  other_label text not null default 'andra hushållet',
  follows_child uuid references members(id) on delete set null,
  created_at timestamptz not null default now()
);
create or replace function my_car_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from cars where household_id in (select my_household_ids()) or link_id in (select my_link_ids())
$$;
create table if not exists car_costs (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references cars(id) on delete cascade,
  day date not null,
  amount numeric not null,
  kind text not null default 'ovrigt',
  shared boolean not null default true,
  paid_by_household uuid references households(id) on delete set null, -- null = andra (ej kopplat) hushållet
  paid_by_name text,
  note text,
  odometer int,
  created_at timestamptz not null default now()
);
create table if not exists car_settlements (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references cars(id) on delete cascade,
  day date not null,
  amount numeric not null,
  from_household uuid references households(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
alter table cars enable row level security;
alter table car_costs enable row level security;
alter table car_settlements enable row level security;
create policy "egen eller kopplad bil" on cars for all
  using (id in (select my_car_ids()) or household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()) or link_id in (select my_link_ids()));
create policy "bilens kostnader" on car_costs for all using (car_id in (select my_car_ids())) with check (car_id in (select my_car_ids()));
create policy "bilens regleringar" on car_settlements for all using (car_id in (select my_car_ids())) with check (car_id in (select my_car_ids()));

alter publication supabase_realtime add table household_links, shared_children, custody, cars, car_costs, car_settlements;

-- Skapa en kod för att dela barn med andra vårdnadshavaren
create or replace function create_link_invite(children uuid[]) returns text
language plpgsql security definer set search_path = public as $$
declare me members%rowtype; c text;
begin
  select * into me from members where user_id = auth.uid();
  if me.id is null then raise exception 'Inte inloggad'; end if;
  if exists (select 1 from unnest(children) x where x not in (select id from members where household_id = me.household_id and role = 'child')) then
    raise exception 'Barnet finns inte i ditt hushåll';
  end if;
  c := 'D' || upper(substr(md5(random()::text), 1, 5));
  insert into link_invites (code, household_id, child_ids, created_by) values (c, me.household_id, children, me.id);
  return c;
end $$;

-- Använd koden: koppla mitt hushåll (eller ett nytt) till det som bjöd in
create or replace function accept_link_invite(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me members%rowtype; inv link_invites%rowtype; lid uuid; ch uuid;
begin
  select * into me from members where user_id = auth.uid();
  if me.id is null then raise exception 'Skapa din familj först'; end if;
  select * into inv from link_invites where link_invites.code = upper(trim(accept_link_invite.code));
  if inv.code is null then raise exception 'Fel kod'; end if;
  if inv.created_at < now() - interval '30 days' then raise exception 'Koden har gått ut'; end if;
  if inv.household_id = me.household_id then raise exception 'Koden är från ditt eget hushåll'; end if;
  insert into household_links (a, b) values (inv.household_id, me.household_id)
    on conflict (a, b) do update set a = excluded.a returning id into lid;
  foreach ch in array inv.child_ids loop
    insert into shared_children (link_id, child_id) values (lid, ch) on conflict do nothing;
  end loop;
  update link_invites set used_at = now() where link_invites.code = inv.code;
  update custody set link_id = lid where household_id = inv.household_id and child_id = any(inv.child_ids) and link_id is null;
  update cars set link_id = lid where household_id = inv.household_id and link_id is null and follows_child = any(inv.child_ids);
  return lid;
end $$;

-- Namn och färger på föräldrarna i kopplade hushåll (utan inkomster m.m.)
create or replace function linked_people() returns table (id uuid, name text, color text, household_id uuid, household_name text, phone text)
language sql stable security definer set search_path = public as $$
  select m.id, m.name, m.color, m.household_id, h.name, m.phone
  from members m join households h on h.id = m.household_id
  where m.household_id in (select my_linked_household_ids()) and m.role = 'parent'
$$;
create or replace function linked_households() returns table (link_id uuid, household_id uuid, name text)
language sql stable security definer set search_path = public as $$
  select l.id, h.id, h.name from household_links l
  join households h on h.id = case when l.a in (select my_household_ids()) then l.b else l.a end
  where l.id in (select my_link_ids())
$$;

revoke execute on function my_link_ids(), my_shared_child_ids(), my_linked_household_ids(), my_car_ids() from public, anon;
grant execute on function my_link_ids(), my_shared_child_ids(), my_linked_household_ids(), my_car_ids() to authenticated;
revoke execute on function create_link_invite(uuid[]), accept_link_invite(text), linked_people(), linked_households() from public, anon;
grant execute on function create_link_invite(uuid[]), accept_link_invite(text), linked_people(), linked_households() to authenticated;

-- Bilens påminnelser (besiktning, däck, försäkring) visas på bilsidan i stället för bland årliga saker
alter table reminders add column if not exists car_id uuid references cars(id) on delete cascade;
create policy "bilens påminnelser" on reminders for all
  using (car_id in (select my_car_ids())) with check (car_id in (select my_car_ids()));
