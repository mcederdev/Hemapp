-- Stora omgången: medicin, hämta/lämna, lov i schemat, humör, matkostnad, skafferi, abonnemang,
-- väder, tema, profilbilder, gäster (mor- och farföräldrar)

-- Medicin per barn: flaskans storlek, dos och när flaskan öppnades
create table if not exists medicines (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  name text not null,
  unit text not null default 'ml',
  bottle_size numeric not null default 100,
  dose numeric not null default 5,
  doses_per_day numeric not null default 1,
  opened_on date not null default current_date,
  remind_days int not null default 5,
  notified_for date,
  notified_by jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);
alter table medicines enable row level security;
create policy "egen eller delat barns medicin" on medicines for all
  using (household_id in (select my_household_ids()) or member_id in (select my_shared_child_ids()))
  with check (household_id in (select my_household_ids()) or member_id in (select my_shared_child_ids()));

-- Hämta och lämna: vem som lämnar/hämtar barnet en viss dag
create table if not exists pickups (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  child_id uuid not null references members(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('lamna', 'hamta')),
  person_id uuid,
  person_name text,
  at_time time,
  note text,
  created_at timestamptz not null default now(),
  unique (child_id, day, kind)
);
alter table pickups enable row level security;
create policy "eget eller delat barns hämtning" on pickups for all
  using (household_id in (select my_household_ids()) or child_id in (select my_shared_child_ids()))
  with check (household_id in (select my_household_ids()) or child_id in (select my_shared_child_ids()));

-- Lov och semester: avvikelser från växelvisa schemat
create table if not exists custody_exceptions (
  id uuid primary key default gen_random_uuid(),
  custody_id uuid not null references custody(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  with_anchor boolean not null,
  note text,
  created_at timestamptz not null default now()
);
alter table custody_exceptions enable row level security;
create policy "schemats avvikelser" on custody_exceptions for all
  using (custody_id in (select id from custody)) with check (custody_id in (select id from custody));

-- Packlistan syns för båda hushållen. returned_for = bytet då saken skickades tillbaka.
alter table packing_items add column if not exists returned_for date;
create policy "delat barns packlista" on packing_items for all
  using (child_id in (select my_shared_child_ids())) with check (child_id in (select my_shared_child_ids()));

-- Humör för barnet
create table if not exists moods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  day date not null,
  mood int not null check (mood between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  unique (household_id, member_id, day)
);
alter table moods enable row level security;
create policy "eget humör" on moods for all
  using (household_id in (select my_household_ids())) with check (household_id in (select my_household_ids()));

-- Vad handlingen kostade
create table if not exists grocery_spend (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  day date not null default current_date,
  amount numeric not null,
  store text,
  list_id uuid references shopping_lists(id) on delete set null,
  member_id uuid references members(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table grocery_spend enable row level security;
create policy "egna kvitton" on grocery_spend for all
  using (household_id in (select my_household_ids())) with check (household_id in (select my_household_ids()));

-- Skafferi, kyl och frys
create table if not exists pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  place text not null default 'skafferi',
  best_before date,
  qty text,
  created_at timestamptz not null default now()
);
alter table pantry_items enable row level security;
create policy "eget skafferi" on pantry_items for all
  using (household_id in (select my_household_ids())) with check (household_id in (select my_household_ids()));

-- Abonnemang
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  amount numeric not null default 0,
  period text not null default 'month' check (period in ('month', 'year')),
  renews_on date,
  cancel_by date,
  paid_by uuid references members(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
alter table subscriptions enable row level security;
create policy "egna abonnemang" on subscriptions for all
  using (household_id in (select my_household_ids())) with check (household_id in (select my_household_ids()));

-- Hushållets plats (väder), tema och veckoöversikt
alter table households add column if not exists lat numeric;
alter table households add column if not exists lon numeric;
alter table households add column if not exists place_name text;
alter table households add column if not exists theme jsonb not null default '{}'::jsonb;
alter table households add column if not exists last_week_push date;
alter table members add column if not exists avatar_url text;

-- Profilbilder
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
create policy "profilbilder laddas upp av hushållet" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1]::uuid in (select my_household_ids()));
create policy "profilbilder byts av hushållet" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1]::uuid in (select my_household_ids()));

-- Gäster (t.ex. mor- och farföräldrar): ser kalender, lappar och meddelanden, kan skriva lappar och meddelanden
create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#8a7a6a',
  created_at timestamptz not null default now()
);
create table if not exists guest_invites (
  code text primary key,
  household_id uuid not null references households(id) on delete cascade,
  created_at timestamptz not null default now()
);
create or replace function my_guest_household_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select household_id from guests where user_id = auth.uid()
$$;
create or replace function my_guest_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from guests where user_id = auth.uid()
$$;
alter table guests enable row level security;
alter table guest_invites enable row level security;
create policy "hushållet ser sina gäster" on guests for all
  using (household_id in (select my_household_ids()) or user_id = auth.uid())
  with check (household_id in (select my_household_ids()));
create policy "hushållets gästkoder" on guest_invites for all
  using (household_id in (select my_household_ids())) with check (household_id in (select my_household_ids()));

alter table messages add column if not exists guest_author uuid references guests(id) on delete set null;
alter table notes add column if not exists guest_author uuid references guests(id) on delete set null;

create policy "gäst ser hushållet" on households for select using (id in (select my_guest_household_ids()));
create policy "gäst ser medlemmar" on members for select using (household_id in (select my_guest_household_ids()));
create policy "gäst ser kalendern" on events for select using (household_id in (select my_guest_household_ids()));
create policy "gäst ser lappar" on notes for select using (household_id in (select my_guest_household_ids()));
create policy "gäst skriver lappar" on notes for insert
  with check (household_id in (select my_guest_household_ids()) and guest_author = my_guest_id());
create policy "gäst ser meddelanden" on messages for select
  using (link_id is null and household_id in (select my_guest_household_ids()));
create policy "gäst skriver meddelanden" on messages for insert
  with check (link_id is null and household_id in (select my_guest_household_ids()) and guest_author = my_guest_id() and author is null);
create policy "gäst ser schemat" on custody for select using (household_id in (select my_guest_household_ids()));
create policy "gäst ser födelsedagar" on birthdays for select using (household_id in (select my_guest_household_ids()));
create policy "gäst ser middagar" on meal_plan for select using (household_id in (select my_guest_household_ids()));

create or replace function create_guest_invite() returns text
language plpgsql security definer set search_path = public as $$
declare me members%rowtype; c text;
begin
  select * into me from members where user_id = auth.uid();
  if me.id is null then raise exception 'Inte inloggad'; end if;
  c := 'G' || upper(substr(md5(random()::text), 1, 5));
  insert into guest_invites (code, household_id) values (c, me.household_id);
  return c;
end $$;

create or replace function accept_guest_invite(code text, my_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv guest_invites%rowtype; gid uuid;
begin
  if auth.uid() is null then raise exception 'Inte inloggad'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'Du är redan med i en familj'; end if;
  select * into inv from guest_invites where guest_invites.code = upper(trim(accept_guest_invite.code));
  if inv.code is null then raise exception 'Fel kod'; end if;
  if inv.created_at < now() - interval '30 days' then raise exception 'Koden har gått ut'; end if;
  insert into guests (household_id, user_id, name) values (inv.household_id, auth.uid(), coalesce(nullif(trim(my_name), ''), 'Gäst'))
    on conflict (user_id) do update set household_id = excluded.household_id, name = excluded.name returning id into gid;
  return gid;
end $$;

revoke execute on function my_guest_household_ids(), my_guest_id(), create_guest_invite(), accept_guest_invite(text, text) from public, anon;
grant execute on function my_guest_household_ids(), my_guest_id(), create_guest_invite(), accept_guest_invite(text, text) to authenticated;

alter publication supabase_realtime add table medicines, pickups, custody_exceptions, moods, grocery_spend, pantry_items, subscriptions, guests;
