-- CustodialSupport live-sync migration.
-- Existing RLS policies remain unchanged. Minimal client mirrors prevent admin_note
-- and internal ticket messages from being broadcast to client browsers.
begin;
create table if not exists public.client_profile_realtime as select id, full_name from public.profiles with no data;
create unique index if not exists client_profile_realtime_id_idx on public.client_profile_realtime(id);
create table if not exists public.client_withdrawal_realtime as select id, client_id, amount, currency, crypto_asset, crypto_amount, status, transaction_reference, created_at from public.withdrawals with no data;
create unique index if not exists client_withdrawal_realtime_id_idx on public.client_withdrawal_realtime(id);
create table if not exists public.client_ticket_message_realtime as
  select m.id, m.ticket_id, t.client_id, m.sender_id, m.message, false::boolean as is_internal, m.created_at
  from public.ticket_messages m join public.support_tickets t on t.id = m.ticket_id with no data;
create unique index if not exists client_ticket_message_realtime_id_idx on public.client_ticket_message_realtime(id);
create index if not exists client_ticket_message_realtime_ticket_idx on public.client_ticket_message_realtime(ticket_id);
alter table public.client_profile_realtime enable row level security;
alter table public.client_withdrawal_realtime enable row level security;
alter table public.client_ticket_message_realtime enable row level security;
alter table public.client_profile_realtime replica identity full;
alter table public.client_withdrawal_realtime replica identity full;
alter table public.client_ticket_message_realtime replica identity full;
revoke all on public.client_profile_realtime from anon;
revoke all on public.client_withdrawal_realtime from anon;
revoke all on public.client_ticket_message_realtime from anon;
grant select on public.client_profile_realtime to authenticated;
grant select on public.client_withdrawal_realtime to authenticated;
grant select on public.client_ticket_message_realtime to authenticated;
drop policy if exists client_profile_realtime_read_scoped on public.client_profile_realtime;
create policy client_profile_realtime_read_scoped on public.client_profile_realtime for select to authenticated using (
  id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
drop policy if exists client_withdrawal_realtime_read_scoped on public.client_withdrawal_realtime;
create policy client_withdrawal_realtime_read_scoped on public.client_withdrawal_realtime for select to authenticated using (
  client_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
drop policy if exists client_ticket_message_realtime_read_scoped on public.client_ticket_message_realtime;
create policy client_ticket_message_realtime_read_scoped on public.client_ticket_message_realtime for select to authenticated using (
  client_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create or replace function public.sync_client_profile_realtime() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then delete from public.client_profile_realtime where id = old.id; return old; end if;
  insert into public.client_profile_realtime(id, full_name) values (new.id, new.full_name)
    on conflict (id) do update set full_name = excluded.full_name;
  return new;
end; $$;
drop trigger if exists profiles_client_realtime_sync on public.profiles;
create trigger profiles_client_realtime_sync after insert or update or delete on public.profiles for each row execute function public.sync_client_profile_realtime();
create or replace function public.sync_client_withdrawal_realtime() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then delete from public.client_withdrawal_realtime where id = old.id; return old; end if;
  insert into public.client_withdrawal_realtime(id, client_id, amount, currency, crypto_asset, crypto_amount, status, transaction_reference, created_at)
  values (new.id, new.client_id, new.amount, new.currency, new.crypto_asset, new.crypto_amount, new.status, new.transaction_reference, new.created_at)
  on conflict (id) do update set client_id=excluded.client_id, amount=excluded.amount, currency=excluded.currency, crypto_asset=excluded.crypto_asset,
    crypto_amount=excluded.crypto_amount, status=excluded.status, transaction_reference=excluded.transaction_reference, created_at=excluded.created_at;
  return new;
end; $$;
drop trigger if exists withdrawals_client_realtime_sync on public.withdrawals;
create trigger withdrawals_client_realtime_sync after insert or update or delete on public.withdrawals for each row execute function public.sync_client_withdrawal_realtime();
create or replace function public.sync_client_ticket_message_realtime() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_client_id uuid;
begin
  if tg_op = 'DELETE' or tg_op = 'UPDATE' then
    delete from public.client_ticket_message_realtime where id = old.id;
    if tg_op = 'DELETE' then return old; end if;
  end if;
  if not new.is_internal then
    select t.client_id into v_client_id from public.support_tickets t where t.id = new.ticket_id;
    if v_client_id is not null then
      insert into public.client_ticket_message_realtime(id, ticket_id, client_id, sender_id, message, is_internal, created_at)
      values (new.id, new.ticket_id, v_client_id, new.sender_id, new.message, false, new.created_at)
      on conflict (id) do update set ticket_id=excluded.ticket_id, client_id=excluded.client_id, sender_id=excluded.sender_id, message=excluded.message, created_at=excluded.created_at;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists ticket_messages_client_realtime_sync on public.ticket_messages;
create trigger ticket_messages_client_realtime_sync after insert or update or delete on public.ticket_messages for each row execute function public.sync_client_ticket_message_realtime();
insert into public.client_profile_realtime(id, full_name) select id, full_name from public.profiles
  on conflict (id) do update set full_name=excluded.full_name;
insert into public.client_withdrawal_realtime(id, client_id, amount, currency, crypto_asset, crypto_amount, status, transaction_reference, created_at)
  select id, client_id, amount, currency, crypto_asset, crypto_amount, status, transaction_reference, created_at from public.withdrawals
  on conflict (id) do update set client_id=excluded.client_id, amount=excluded.amount, currency=excluded.currency, crypto_asset=excluded.crypto_asset,
    crypto_amount=excluded.crypto_amount, status=excluded.status, transaction_reference=excluded.transaction_reference, created_at=excluded.created_at;
insert into public.client_ticket_message_realtime(id, ticket_id, client_id, sender_id, message, is_internal, created_at)
  select m.id, m.ticket_id, t.client_id, m.sender_id, m.message, false, m.created_at from public.ticket_messages m
    join public.support_tickets t on t.id=m.ticket_id where m.is_internal=false
  on conflict (id) do update set ticket_id=excluded.ticket_id, client_id=excluded.client_id, sender_id=excluded.sender_id, message=excluded.message, created_at=excluded.created_at;
do $$
declare v_table text;
begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then raise exception 'Publication supabase_realtime does not exist.'; end if;
  foreach v_table in array array['profiles','support_tickets','ticket_messages','withdrawals','notifications','activity_logs','admin_settings','client_profile_realtime','client_withdrawal_realtime','client_ticket_message_realtime'] loop
    if to_regclass('public.'||v_table) is null then raise notice 'Skipping missing table public.%',v_table;
    elsif not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=v_table) then
      execute format('alter publication supabase_realtime add table public.%I',v_table);
    end if;
  end loop;
end; $$;
commit;
select schemaname, tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' order by tablename;
