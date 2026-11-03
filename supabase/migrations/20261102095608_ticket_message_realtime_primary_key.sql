-- Supabase Postgres Changes requires a primary key to publish row payloads.
-- The message mirror was created with CTAS, which only had a unique index.
-- Keep the existing rows, participant RLS policies and safe message projection.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.client_ticket_message_realtime'::regclass
      and contype = 'p'
  ) then
    alter table public.client_ticket_message_realtime
      add constraint client_ticket_message_realtime_pkey
      primary key using index client_ticket_message_realtime_id_idx;
  end if;
end;
$$;
