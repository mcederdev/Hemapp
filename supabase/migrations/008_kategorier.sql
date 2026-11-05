-- Kategorier på kalenderposter, och regler för automatisk kategorisering (t.ex. M1L… = jobb)
alter table events add column if not exists category text;
alter table households add column if not exists category_rules jsonb not null default '[]';
