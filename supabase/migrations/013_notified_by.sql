alter table reminders add column if not exists notified_by jsonb not null default '{}'::jsonb;
alter table custody add column if not exists notified_by jsonb not null default '{}'::jsonb;
