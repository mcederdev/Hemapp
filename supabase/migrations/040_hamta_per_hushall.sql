-- Lämna och hämta gäller bara det egna hushållet (delas inte med barnets andra hem)
create policy "lämna och hämta bara i eget hushåll" on public.pickups as restrictive for all
  using (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));
