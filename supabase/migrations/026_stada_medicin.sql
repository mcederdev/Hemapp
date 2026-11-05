-- Städning: morgon/kväll-versionen av medicin (021) ersattes av tider (022)
drop table if exists public.medicine_doses;
alter table public.medicines drop column if exists dose_morning;
alter table public.medicines drop column if exists dose_evening;
