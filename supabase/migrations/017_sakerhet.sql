-- Säkerhetsgenomgång: längre koder och koder som bara går att använda en gång

-- Hushållets egen inbjudningskod: 8 tecken för nya hushåll (byt kod under Familj)
alter table households alter column invite_code set default upper(substr(md5(gen_random_uuid()::text), 1, 8));

-- Koder för delad vårdnad: 8 tecken, och en använd kod fungerar inte igen
create or replace function create_link_invite(children uuid[]) returns text
language plpgsql security definer set search_path = public as $$
declare me members%rowtype; c text;
begin
  select * into me from members where user_id = auth.uid();
  if me.id is null then raise exception 'Inte inloggad'; end if;
  if exists (select 1 from unnest(children) x where x not in (select id from members where household_id = me.household_id and role = 'child')) then
    raise exception 'Barnet finns inte i ditt hushåll';
  end if;
  c := 'D' || upper(substr(md5(gen_random_uuid()::text), 1, 7));
  insert into link_invites (code, household_id, child_ids, created_by) values (c, me.household_id, children, me.id);
  return c;
end $$;

create or replace function accept_link_invite(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me members%rowtype; inv link_invites%rowtype; lid uuid; ch uuid;
begin
  select * into me from members where user_id = auth.uid();
  if me.id is null then raise exception 'Skapa din familj först'; end if;
  select * into inv from link_invites where link_invites.code = upper(trim(accept_link_invite.code));
  if inv.code is null then raise exception 'Fel kod'; end if;
  if inv.used_at is not null then raise exception 'Koden är redan använd. Be om en ny.'; end if;
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

-- Gästkoder: 8 tecken och engångs
alter table guest_invites add column if not exists used_at timestamptz;

create or replace function create_guest_invite() returns text
language plpgsql security definer set search_path = public as $$
declare me members%rowtype; c text;
begin
  select * into me from members where user_id = auth.uid();
  if me.id is null then raise exception 'Inte inloggad'; end if;
  c := 'G' || upper(substr(md5(gen_random_uuid()::text), 1, 7));
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
  if inv.used_at is not null then raise exception 'Koden är redan använd. Be familjen om en ny.'; end if;
  if inv.created_at < now() - interval '30 days' then raise exception 'Koden har gått ut'; end if;
  insert into guests (household_id, user_id, name) values (inv.household_id, auth.uid(), coalesce(nullif(trim(my_name), ''), 'Gäst'))
    on conflict (user_id) do update set household_id = excluded.household_id, name = excluded.name returning id into gid;
  update guest_invites set used_at = now() where guest_invites.code = inv.code;
  return gid;
end $$;

-- En gäst kan inte samtidigt gå med i en familj som förälder
create or replace function join_household(code text, my_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'Inte inloggad'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'Du tillhör redan ett hushåll';
  end if;
  if length(trim(code)) < 6 then raise exception 'Fel kod'; end if;
  select id into hid from households where invite_code = upper(trim(code));
  if hid is null then raise exception 'Fel kod'; end if;
  insert into members (household_id, user_id, name, role, color)
    values (hid, auth.uid(), my_name, 'parent', '#e0567a');
  return hid;
end $$;
