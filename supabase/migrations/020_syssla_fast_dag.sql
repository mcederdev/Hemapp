-- Återkommande syssla med valt datum: syns först den dagen, nästa läggs till när den bockas av (fixed_day)
-- Utan datum ligger den fritt under veckan/månaden och servern lägger till nästa på måndagen / den 1:a
alter table public.chores add column if not exists fixed_day boolean not null default false;
update public.chores c set fixed_day = true, repeat_every = p.every, repeat_unit = p.unit
from public.chore_plans p
where c.plan_id = p.id and not c.done and c.due_date is not null
  and not (p.unit = 'week' and c.due_date = (date_trunc('week', current_date)::date + 6))
  and not (p.unit = 'month' and c.due_date = (date_trunc('month', current_date) + interval '1 month - 1 day')::date)
  and p.unit <> 'day';
