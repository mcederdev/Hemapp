-- Komplettera: det som tagit slut hemma hamnar här. Appen tar bort varan härifrån när den bockas av i någon lista.
alter table shopping_lists add column if not exists is_refill boolean not null default false;
insert into shopping_lists (household_id, name, is_refill)
  select h.id, 'Komplettera', true from households h
  where not exists (select 1 from shopping_lists l where l.household_id = h.id and l.is_refill);
