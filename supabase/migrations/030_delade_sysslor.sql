-- Sysslor som delas med det kopplade hushållet (barnets sysslor) och bilens sysslor
alter table chores add column if not exists shared boolean not null default false;
alter table chores add column if not exists car_id uuid references cars(id) on delete cascade;
alter table chores add column if not exists booked_at timestamptz;
create index if not exists chores_car_id on chores(car_id);
create policy "delade sysslor och bilens sysslor" on chores for all
  using ((shared and household_id in (select my_linked_household_ids())) or car_id in (select my_car_ids()))
  with check ((shared and household_id in (select my_linked_household_ids())) or car_id in (select my_car_ids()) or household_id in (select my_household_ids()));
