-- Återkommande kostnader: varje månad (1), kvartal (3) eller år (12)
-- Bara nya kolumner, inget tas bort. Äldre versioner av appen bryr sig inte om dem.
alter table car_costs add column if not exists every_months int check (every_months in (1, 3, 12));
alter table bills add column if not exists every_months int check (every_months in (1, 3, 12));
alter table subscriptions add column if not exists every_months int check (every_months in (1, 3, 12));
