alter table households add column if not exists hidden_dishes text[] not null default '{}';
