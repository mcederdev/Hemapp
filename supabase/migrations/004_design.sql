-- Design v4: barnens rutiner, sparmål och notis när någon har handlat

-- Rutinkort (morgon/kväll) per barn
create table if not exists routines (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  part text not null default 'morning' check (part in ('morning','evening')),
  emoji text not null default '⭐',
  title text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
-- En bock per rutin och dag
create table if not exists routine_checks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  routine_id uuid not null references routines(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  unique (routine_id, day)
);
-- Sparmål per barn, räknas i stjärnor intjänade sedan goal_since
alter table members add column if not exists goal_title text;
alter table members add column if not exists goal_amount numeric;
alter table members add column if not exists goal_since date;

alter table routines enable row level security;
alter table routine_checks enable row level security;
do $$
declare t text;
begin
  foreach t in array array['routines','routine_checks'] loop
    execute format(
      'create policy "eget hushåll" on %I for all
         using (household_id in (select my_household_ids()))
         with check (household_id in (select my_household_ids()))', t);
  end loop;
end $$;
alter publication supabase_realtime add table routines, routine_checks;

-- Skicka en notis till resten av hushållet (t.ex. "Magnus har handlat")
create or replace function notify_household(msg text, link text default '/') returns void
language plpgsql security definer set search_path = public, extensions as $$
declare m members%rowtype;
begin
  select * into m from members where user_id = auth.uid();
  if m.id is null then raise exception 'Inte inloggad'; end if;
  perform net.http_post(
    url := (select value from app_secrets where name = 'function_url'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select value from app_secrets where name = 'cron_secret')),
    body := jsonb_build_object('notify', true, 'member_id', m.id, 'household_id', m.household_id,
      'title', m.name || ' ' || left(msg, 120), 'url', link));
end $$;
revoke execute on function notify_household(text, text) from public, anon;
grant execute on function notify_household(text, text) to authenticated;
