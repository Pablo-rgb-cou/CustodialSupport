-- Repair the client-safe projection without exposing administrative columns.
-- CTAS did not copy the withdrawals primary key; Realtime needs row identity.
do $$
begin
  if not exists (select 1 from pg_constraint
    where conrelid = 'public.client_withdrawal_realtime'::regclass and contype = 'p') then
    alter table public.client_withdrawal_realtime
      add constraint client_withdrawal_realtime_pkey
      primary key using index client_withdrawal_realtime_id_idx;
  end if;
end;
$$;

create or replace function public.sync_client_withdrawal_realtime()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    delete from public.client_withdrawal_realtime where id = old.id;
    return old;
  end if;
  insert into public.client_withdrawal_realtime
    (id, client_id, amount, currency, crypto_asset, crypto_amount, status,
     transaction_reference, created_at, wallet_address)
  values (new.id, new.client_id, new.amount, new.currency, new.crypto_asset,
    new.crypto_amount, new.status, new.transaction_reference, new.created_at, new.wallet_address)
  on conflict (id) do update set
    client_id = excluded.client_id, amount = excluded.amount,
    currency = excluded.currency, crypto_asset = excluded.crypto_asset,
    crypto_amount = excluded.crypto_amount, status = excluded.status,
    transaction_reference = excluded.transaction_reference,
    created_at = excluded.created_at, wallet_address = excluded.wallet_address;
  return new;
end;
$$;

-- Bring existing mirrored records up to date, including their missing statuses.
insert into public.client_withdrawal_realtime
  (id, client_id, amount, currency, crypto_asset, crypto_amount, status,
   transaction_reference, created_at, wallet_address)
select id, client_id, amount, currency, crypto_asset, crypto_amount, status,
  transaction_reference, created_at, wallet_address from public.withdrawals
on conflict (id) do update set
  client_id = excluded.client_id, amount = excluded.amount,
  currency = excluded.currency, crypto_asset = excluded.crypto_asset,
  crypto_amount = excluded.crypto_amount, status = excluded.status,
  transaction_reference = excluded.transaction_reference,
  created_at = excluded.created_at, wallet_address = excluded.wallet_address;
