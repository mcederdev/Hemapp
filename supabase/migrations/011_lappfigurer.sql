alter table notes add column if not exists sticker text;
alter table notes add column if not exists to_member uuid references members(id) on delete set null;
