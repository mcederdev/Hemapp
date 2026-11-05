-- Packlista inför bytet (per hushåll och barn). packed_for = det byte saken är packad inför.
create table if not exists packing_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  child_id uuid not null references members(id) on delete cascade,
  title text not null,
  sort int not null default 0,
  packed_for date,
  created_at timestamptz not null default now()
);
alter table packing_items enable row level security;
create policy "egen packlista" on packing_items for all
  using (household_id in (select my_household_ids())) with check (household_id in (select my_household_ids()));

-- Meddelanden: link_id null = inom familjen, annars mellan de kopplade hushållen
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  link_id uuid references household_links(id) on delete cascade,
  author uuid references members(id) on delete set null,
  text text not null default '',
  sticker text,
  created_at timestamptz not null default now()
);
create index if not exists messages_household_idx on messages (household_id, created_at);
create index if not exists messages_link_idx on messages (link_id, created_at);
alter table messages enable row level security;
create policy "läsa meddelanden" on messages for select
  using ((link_id is null and household_id in (select my_household_ids())) or link_id in (select my_link_ids()));
create policy "skriva meddelanden" on messages for insert
  with check (household_id in (select my_household_ids())
    and author in (select id from members where user_id = auth.uid())
    and (link_id is null or link_id in (select my_link_ids())));
create policy "ta bort egna meddelanden" on messages for delete
  using (author in (select id from members where user_id = auth.uid()));
alter publication supabase_realtime add table packing_items, messages;

-- Notis till det kopplade hushållet (meddelanden mellan hushållen)
create or replace function notify_linked(link uuid, msg text, url text default '/') returns void
language plpgsql security definer set search_path = public, extensions as $$
declare m members%rowtype; other uuid;
begin
  select * into m from members where user_id = auth.uid();
  if m.id is null then raise exception 'Inte inloggad'; end if;
  select case when l.a = m.household_id then l.b else l.a end into other
    from household_links l where l.id = link and (l.a = m.household_id or l.b = m.household_id);
  if other is null then raise exception 'Inte kopplad'; end if;
  perform net.http_post(
    url := (select value from app_secrets where name = 'function_url'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select value from app_secrets where name = 'cron_secret')),
    body := jsonb_build_object('notify', true, 'member_id', m.id, 'household_id', other,
      'title', m.name || ' ' || left(msg, 120), 'url', url));
end $$;
revoke execute on function notify_linked(uuid, text, text) from public, anon;
grant execute on function notify_linked(uuid, text, text) to authenticated;
