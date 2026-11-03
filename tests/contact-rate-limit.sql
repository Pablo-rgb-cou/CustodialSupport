-- Run only after the contact limiter migration. All test changes are rolled back.
begin;
delete from support_private.contact_rate_limits;
do $verify$
declare
  v_result jsonb;
  v_index integer;
  v_email text := repeat('a', 64);
  v_ip text := repeat('b', 64);
begin
  for v_index in 1..3 loop
    v_result := public.claim_contact_email_slot(v_email, v_ip);
    if not (v_result->>'allowed')::boolean then raise exception 'Expected initial email slots'; end if;
  end loop;
  v_result := public.claim_contact_email_slot(v_email, v_ip);
  if (v_result->>'allowed')::boolean or (v_result->>'retry_after')::integer <= 0 then
    raise exception 'Per-email rate limit was not enforced';
  end if;
  for v_index in 1..2 loop
    v_result := public.claim_contact_email_slot(md5(v_index::text) || md5((v_index + 100)::text), v_ip);
    if not (v_result->>'allowed')::boolean then raise exception 'Expected remaining IP slots'; end if;
  end loop;
  v_result := public.claim_contact_email_slot(repeat('c',64), v_ip);
  if (v_result->>'allowed')::boolean then raise exception 'Per-IP limit was not enforced'; end if;

  update support_private.contact_rate_limits set request_count=40 where bucket='global-hour';
  v_result := public.claim_contact_email_slot(repeat('d',64),repeat('e',64));
  if (v_result->>'allowed')::boolean then raise exception 'Global hourly limit was not enforced'; end if;
  update support_private.contact_rate_limits set request_count=1 where bucket='global-hour';
  update support_private.contact_rate_limits set request_count=200 where bucket='global-day';
  v_result := public.claim_contact_email_slot(repeat('d',64),repeat('e',64));
  if (v_result->>'allowed')::boolean then raise exception 'Global daily limit was not enforced'; end if;

  if has_schema_privilege('authenticated','support_private','usage')
    or has_function_privilege('authenticated','public.claim_contact_email_slot(text,text)','execute')
    or has_function_privilege('anon','public.claim_contact_email_slot(text,text)','execute') then
    raise exception 'Browser role can reach the private limiter';
  end if;
  if not has_function_privilege('service_role','public.claim_contact_email_slot(text,text)','execute') then
    raise exception 'Server role lacks limiter access';
  end if;
end;
$verify$;
rollback;
select 'PASS: contact per-email/IP/hour/day limits and browser isolation; all test changes rolled back.' as result;
