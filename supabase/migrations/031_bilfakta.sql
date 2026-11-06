alter table cars add column if not exists model text;
alter table cars add column if not exists model_year int;
alter table cars add column if not exists fuel text;
alter table cars add column if not exists tax_per_year numeric;
alter table cars add column if not exists in_traffic date;
alter table cars add column if not exists last_inspection date;
