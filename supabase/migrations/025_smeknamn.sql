-- Smeknamn: varje förälder kan ge familjemedlemmar egna namn som bara visas för hen ({member_id: namn})
alter table public.members add column if not exists nicknames jsonb not null default '{}'::jsonb;
