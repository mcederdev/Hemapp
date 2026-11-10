-- Mat och handla: mängder på varorna, och recept (länk, portioner, gör så här) på rätterna.
-- Bara nya kolumner, så appen som redan är ute fortsätter fungera (den läser items som förut).

-- Varor per rätt med mängd: [{ "name": "Gurka", "qty": "1 st" }, ...]. items (bara namn) skrivs fortfarande.
alter table public.dish_items add column if not exists lines jsonb;
alter table public.dish_items add column if not exists servings int;
alter table public.dish_items add column if not exists recipe_url text;
alter table public.dish_items add column if not exists instructions text;

-- Mängd på inköpslistan, t.ex. "2 st" eller "500 g + 1 burk"
alter table public.shopping_items add column if not exists qty text;
