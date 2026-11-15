-- Delad vårdnad: stoppa att en andra vuxen i samma hem råkar skapa ett eget hushåll.
-- 2026-11-15 skapade Ronja hushållet "Pappa Kim" med en gammal D-kod, fast hon skulle gå med i Familjen Åberg.
-- Bara tillägg (en ny kolumn och nya/ändrade funktioner), så appen som redan är ute fungerar som förut.

alter table link_invites add column if not exists revoked_at timestamptz;

-- Kolla en D-kod INNAN hushållet skapas. Säger om koden fungerar och om barnet redan delas med ett annat hem.
create or replace function check_link_invite(code text) returns json
language plpgsql security definer set search_path = public as $$
declare inv link_invites%rowtype; mine uuid; kids text; already json;
begin
  if auth.uid() is null then raise exception 'Inte inloggad'; end if;
  select household_id into mine from members where user_id = auth.uid() limit 1;
  select * into inv from link_invites where link_invites.code = upper(trim(check_link_invite.code));
  if inv.code is null then return json_build_object('ok', false, 'error', 'Fel kod'); end if;
  if inv.used_at is not null then return json_build_object('ok', false, 'error', 'Koden är redan använd. Be om en ny.'); end if;
  if inv.revoked_at is not null then return json_build_object('ok', false, 'error', 'Koden har ersatts av en nyare. Be om den senaste koden.'); end if;
  if inv.created_at < now() - interval '30 days' then return json_build_object('ok', false, 'error', 'Koden har gått ut'); end if;
  if inv.household_id = mine then return json_build_object('ok', false, 'error', 'Koden är från ditt eget hushåll'); end if;
  select string_agg(name, ' och ') into kids from members where id = any(inv.child_ids);
  select coalesce(json_agg(distinct h.name), '[]'::json) into already
    from shared_children s
    join household_links l on l.id = s.link_id
    join households h on h.id = case when l.a = inv.household_id then l.b else l.a end
    where s.child_id = any(inv.child_ids)
      and inv.household_id in (l.a, l.b)
      and h.id is distinct from mine;
  return json_build_object('ok', true, 'children', kids, 'already_linked', already);
end $$;

-- Ny D-kod: äldre oanvända koder för samma barn slutar gälla
create or replace function create_link_invite(children uuid[]) returns text
language plpgsql security definer set search_path = public as $$
declare me members%rowtype; c text;
begin
  select * into me from members where user_id = auth.uid();
  if me.id is null then raise exception 'Inte inloggad'; end if;
  if exists (select 1 from unnest(children) x where x not in (select id from members where household_id = me.household_id and role = 'child')) then
    raise exception 'Barnet finns inte i ditt hushåll';
  end if;
  update link_invites set revoked_at = now()
    where household_id = me.household_id and used_at is null and revoked_at is null and child_ids && children;
  c := 'D' || upper(substr(md5(gen_random_uuid()::text), 1, 7));
  insert into link_invites (code, household_id, child_ids, created_by) values (c, me.household_id, children, me.id);
  return c;
end $$;

-- Använd D-kod: ersatta koder går inte att använda, och när en kod används slutar andra oanvända koder för samma barn gälla
create or replace function accept_link_invite(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me members%rowtype; inv link_invites%rowtype; lid uuid; ch uuid;
begin
  select * into me from members where user_id = auth.uid();
  if me.id is null then raise exception 'Skapa din familj först'; end if;
  select * into inv from link_invites where link_invites.code = upper(trim(accept_link_invite.code));
  if inv.code is null then raise exception 'Fel kod'; end if;
  if inv.used_at is not null then raise exception 'Koden är redan använd. Be om en ny.'; end if;
  if inv.revoked_at is not null then raise exception 'Koden har ersatts av en nyare. Be om den senaste koden.'; end if;
  if inv.created_at < now() - interval '30 days' then raise exception 'Koden har gått ut'; end if;
  if inv.household_id = me.household_id then raise exception 'Koden är från ditt eget hushåll'; end if;
  insert into household_links (a, b) values (inv.household_id, me.household_id)
    on conflict (a, b) do update set a = excluded.a returning id into lid;
  foreach ch in array inv.child_ids loop
    insert into shared_children (link_id, child_id) values (lid, ch) on conflict do nothing;
  end loop;
  update link_invites set used_at = now() where link_invites.code = inv.code;
  update link_invites set revoked_at = now()
    where household_id = inv.household_id and used_at is null and revoked_at is null and child_ids && inv.child_ids;
  update custody set link_id = lid where household_id = inv.household_id and child_id = any(inv.child_ids) and link_id is null;
  update cars set link_id = lid where household_id = inv.household_id and link_id is null and follows_child = any(inv.child_ids);
  return lid;
end $$;

revoke execute on function check_link_invite(text) from public, anon;
grant execute on function check_link_invite(text) to authenticated;
