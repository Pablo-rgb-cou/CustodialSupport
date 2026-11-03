begin;
do $verify$
declare
  c uuid; a uuid; t uuid := gen_random_uuid(); count_jobs integer; j record;
  claimed integer := 0; retried uuid;
begin
  select id into c from public.profiles where role='client' limit 1;
  select id into a from public.profiles where role='admin' limit 1;
  if c is null or a is null then raise exception 'Verification needs existing roles'; end if;
  perform set_config('request.jwt.claim.sub',c::text,true);
  insert into public.support_tickets(id,client_id,subject,description)
  values(t,c,'Rollback-only email verification','Temporary queue verification; rolled back.');
  insert into public.ticket_messages(ticket_id,sender_id,message,is_internal)
  values(t,c,'Rollback-only public reply',false);
  insert into public.ticket_messages(ticket_id,sender_id,message,is_internal)
  values(t,c,'Rollback-only internal reply',true);
  perform set_config('request.jwt.claim.sub',a::text,true);
  insert into public.ticket_messages(ticket_id,sender_id,message,is_internal)
  values(t,a,'Rollback-only administrator reply',false);
  perform set_config('request.jwt.claim.sub','',true);
  insert into public.ticket_messages(ticket_id,sender_id,message,is_internal)
  values(t,c,'Rollback-only server reply',false);
  select count(*) into count_jobs from support_private.email_outbox where ticket_id=t;
  if count_jobs<>2 then raise exception 'Incorrect enqueue count: %',count_jobs; end if;
  for j in select * from public.claim_support_email_jobs(2,c,t) loop
    claimed := claimed+1;
    if public.finish_support_email_job(j.id,gen_random_uuid(),true,null) then
      raise exception 'Incorrect lease token accepted';
    end if;
    if not public.finish_support_email_job(j.id,j.lease_token,claimed=1,'SMTP_TIMEOUT') then
      raise exception 'Correct lease token rejected';
    end if;
    if claimed=2 then retried:=j.id; end if;
  end loop;
  if claimed<>2 then raise exception 'Claim did not return two jobs'; end if;
  if exists(select 1 from public.claim_support_email_jobs(2,c,t)) then
    raise exception 'Retry backoff not respected';
  end if;
  if not exists(select 1 from support_private.email_outbox
    where id=retried and status='pending' and attempts=1 and next_attempt_at>now()) then
    raise exception 'Missing bounded retry';
  end if;
  update support_private.email_outbox
    set status='processing',attempts=6,lease_token=gen_random_uuid(),lease_until=now()-interval '1 second'
    where id=retried;
  perform * from public.claim_support_email_jobs(2,c,t);
  if not exists(select 1 from support_private.email_outbox
    where id=retried and status='failed' and last_error_code='LEASE_EXPIRED' and lease_token is null) then
    raise exception 'Final abandoned lease not terminal';
  end if;
  if has_schema_privilege('authenticated','support_private','usage')
     or has_function_privilege('authenticated','public.claim_support_email_jobs(integer,uuid,uuid)','execute')
     or has_function_privilege('anon','public.finish_support_email_job(uuid,uuid,boolean,text)','execute') then
    raise exception 'Private worker accessible to browser role';
  end if;
end;
$verify$;
rollback;
select 'PASS: client ticket and reply enqueue; admin/internal/server messages excluded; lease ownership; retry backoff; final lease recovery; browser isolation. All fixtures rolled back.' as result;
