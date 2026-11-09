-- "Mest köpta varor" räknas när en vara bockas av (inte när den läggs i en lista).
-- Varor som bockas av i testläget räknas inte. Ångrar man bocken räknas den ner igen.
alter table public.shopping_items add column if not exists is_test boolean not null default false;

-- När en vara läggs till: spara den i katalogen (för förslag) men räkna inte upp
create or replace function bump_catalog() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int := case when new.done and not new.is_test then 1 else 0 end;
begin
  insert into item_catalog (household_id, name, section, times_added, last_added_at)
  values (new.household_id, new.name, new.section, n, now())
  on conflict (household_id, lower(name)) do update
    set times_added = item_catalog.times_added + n,
        last_added_at = now(),
        section = coalesce(excluded.section, item_catalog.section);
  return new;
end $$;

-- När en vara bockas av (eller bocken ångras)
create or replace function count_bought() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.done and not old.done and not new.is_test then
    insert into item_catalog (household_id, name, section, times_added, last_added_at)
    values (new.household_id, new.name, new.section, 1, now())
    on conflict (household_id, lower(name)) do update
      set times_added = item_catalog.times_added + 1,
          section = coalesce(excluded.section, item_catalog.section);
  elsif old.done and not new.done and not old.is_test then
    update item_catalog set times_added = greatest(times_added - 1, 0)
      where household_id = new.household_id and lower(name) = lower(new.name);
  end if;
  return new;
end $$;
create or replace trigger shopping_items_bought after update of done on shopping_items
  for each row execute function count_bought();
