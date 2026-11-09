-- Testläge även för inköpslistan: varor som läggs till i testläget räknas inte i "Mest köpta varor".
alter table public.shopping_items add column if not exists is_test boolean not null default false;

create or replace function bump_catalog() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int := case when new.is_test then 0 else 1 end;
begin
  insert into item_catalog (household_id, name, section, times_added, last_added_at)
  values (new.household_id, new.name, new.section, n, now())
  on conflict (household_id, lower(name)) do update
    set times_added = item_catalog.times_added + n,
        last_added_at = now(),
        section = coalesce(excluded.section, item_catalog.section);
  return new;
end $$;
