-- Pushnotiser: hemliga nycklar, morgonflagga och schemalagt anrop var 5:e minut.
-- Värdena i app_secrets och cron-jobbet läggs in separat (de ska inte ligga i git):
--   insert into app_secrets values ('vapid_public','...'),('vapid_private','...'),
--     ('cron_secret','...'),('function_url','https://<ref>.supabase.co/functions/v1/send-reminders');

create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table households add column if not exists last_morning_push date;

-- Bara servern (service role) kan läsa denna tabell: RLS utan policyer
create table if not exists app_secrets (name text primary key, value text not null);
alter table app_secrets enable row level security;

-- Appen anropar funktionen för en testnotis via denna RPC
create or replace function send_test_push() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare mid uuid; secret text;
begin
  select id into mid from members where user_id = auth.uid();
  if mid is null then raise exception 'Inte inloggad'; end if;
  select value into secret from app_secrets where name = 'cron_secret';
  perform net.http_post(
    url := (select value from app_secrets where name = 'function_url'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    body := jsonb_build_object('test', true, 'member_id', mid));
end $$;
revoke execute on function send_test_push() from public, anon;
grant execute on function send_test_push() to authenticated;

-- Schemalagt anrop (värdena läses från app_secrets)
create or replace function call_reminders() returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := (select value from app_secrets where name = 'function_url'),
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from app_secrets where name = 'cron_secret')),
    body := '{}'::jsonb);
end $$;
revoke execute on function call_reminders() from public, anon, authenticated;
select cron.schedule('send-reminders', '*/5 * * * *', 'select public.call_reminders()');
