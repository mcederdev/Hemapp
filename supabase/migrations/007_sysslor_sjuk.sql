-- Egen sjukfrånvaro, återkommande sysslor och vem som gjorde sysslan
alter table vab_days add column if not exists kind text not null default 'vab' check (kind in ('vab','sick'));

alter table chores add column if not exists done_by uuid references members(id) on delete set null;
alter table chores add column if not exists plan_id uuid;

create table if not exists chore_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  every int not null default 1,
  unit text not null default 'week' check (unit in ('day','week','month')),
  stars int not null default 0,
  assigned_to uuid references members(id) on delete set null,
  last_added date,
  created_at timestamptz not null default now()
);
alter table chores add constraint chores_plan_fk foreign key (plan_id) references chore_plans(id) on delete set null;
alter table chore_plans enable row level security;
create policy "eget hushåll" on chore_plans for all
  using (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));
alter publication supabase_realtime add table chore_plans;
