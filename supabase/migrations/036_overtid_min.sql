alter table overtime_settings add column if not exists min_minutes int not null default 15;
