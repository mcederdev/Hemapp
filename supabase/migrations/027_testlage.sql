-- Testläge: rader som skapas/ändras i testläget räknas inte i statistiken. stats_from = "Nolla statistiken".
alter table public.households add column if not exists stats_from timestamptz;
alter table public.chores add column if not exists is_test boolean not null default false;
alter table public.vab_days add column if not exists is_test boolean not null default false;
alter table public.pickups add column if not exists is_test boolean not null default false;
alter table public.grocery_spend add column if not exists is_test boolean not null default false;
alter table public.meal_plan add column if not exists is_test boolean not null default false;
alter table public.medicine_takes add column if not exists is_test boolean not null default false;
alter table public.moods add column if not exists is_test boolean not null default false;
