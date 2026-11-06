-- Egen lista med tjänster i abonnemangskollen (null = standardlistan)
alter table public.households add column if not exists sub_services jsonb;
