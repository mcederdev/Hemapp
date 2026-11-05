-- Borttagna enskilda tillfällen för återkommande händelser
alter table events add column if not exists exdates timestamptz[] not null default '{}';
