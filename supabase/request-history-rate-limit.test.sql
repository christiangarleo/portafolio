-- Execute in isolated staging after applying review script; rolls back test rows.
begin;
set local role service_role;
do $$
declare
  k text := repeat('a',43);
  i integer;
begin
  if not public.reserve_portfolio_history_email(k) then raise exception 'first reservation denied'; end if;
  if public.reserve_portfolio_history_email(k) then raise exception 'recipient hourly limit failed'; end if;
  for i in 1..9 loop
    if not public.reserve_portfolio_history_email(repeat('b',41)||lpad(i::text,2,'0')) then raise exception 'global limit premature'; end if;
  end loop;
  if public.reserve_portfolio_history_email(repeat('c',43)) then raise exception 'global hourly limit failed'; end if;
  if public.reserve_portfolio_history_email('invalid') then raise exception 'invalid key accepted'; end if;
end;
$$;
reset role;
do $$
begin
  if has_function_privilege('anon','public.reserve_portfolio_history_email(text)','EXECUTE')
    or has_function_privilege('authenticated','public.reserve_portfolio_history_email(text)','EXECUTE')
    or not has_function_privilege('service_role','public.reserve_portfolio_history_email(text)','EXECUTE')
  then raise exception 'RPC privilege mismatch'; end if;
  if has_schema_privilege('anon','portfolio_history_private','USAGE')
    or has_schema_privilege('authenticated','portfolio_history_private','USAGE')
  then raise exception 'private schema privilege mismatch'; end if;
end;
$$;
rollback;
-- Additional QA: concurrent requests in distinct transactions; daily windows with
-- controlled timestamps; expired and cross-RUC token; provider delivery and browser flow.
