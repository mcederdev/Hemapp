alter table cars add column if not exists tax_booked_through date;
update cars set tax_booked_through = current_date where tax_per_year is not null and tax_booked_through is null;
