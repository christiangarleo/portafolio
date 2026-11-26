-- REVIEW SCRIPT — apply only after explicit approval and staging tests.
-- No changes to existing lead data, Auth, or its RLS.
begin;
create schema portfolio_history_private;
revoke all on schema portfolio_history_private from public, anon, authenticated;
grant usage on schema portfolio_history_private to service_role;
create table portfolio_history_private.email_reservations (
  recipient_key text not null check (recipient_key ~ '^[A-Za-z0-9_-]{43}$'),
  reserved_at timestamptz not null
);
alter table portfolio_history_private.email_reservations enable row level security;
revoke all on table portfolio_history_private.email_reservations from public, anon, authenticated;
grant select, insert, delete on table portfolio_history_private.email_reservations to service_role;
create index email_reservations_time on portfolio_history_private.email_reservations(reserved_at);
create index email_reservations_recipient_time on portfolio_history_private.email_reservations(recipient_key,reserved_at);
create function public.reserve_portfolio_history_email(recipient_key text)
returns boolean
language plpgsql
volatile
security invoker
set search_path = pg_catalog
as $$
declare
  reservation_time timestamptz;
begin
  if current_user <> 'service_role' then return false; end if;
  if recipient_key is null or recipient_key !~ '^[A-Za-z0-9_-]{43}$' then return false; end if;
  -- One transaction-level lock covers both recipient and global rolling windows.
  perform pg_catalog.pg_advisory_xact_lock(120039871, 20261126);
  reservation_time := pg_catalog.clock_timestamp();
  delete from portfolio_history_private.email_reservations e
    where e.reserved_at <= reservation_time - interval '24 hours';
  if (select count(*) from portfolio_history_private.email_reservations e where e.reserved_at > reservation_time - interval '1 hour') >= 10
    or (select count(*) from portfolio_history_private.email_reservations e) >= 30
    or exists (select 1 from portfolio_history_private.email_reservations e where e.recipient_key = $1 and e.reserved_at > reservation_time - interval '1 hour')
    or (select count(*) from portfolio_history_private.email_reservations e where e.recipient_key = $1) >= 3
  then return false; end if;
  insert into portfolio_history_private.email_reservations(recipient_key,reserved_at) values ($1,reservation_time);
  return true;
end;
$$;
revoke all on function public.reserve_portfolio_history_email(text) from public, anon, authenticated;
grant execute on function public.reserve_portfolio_history_email(text) to service_role;
commit;
