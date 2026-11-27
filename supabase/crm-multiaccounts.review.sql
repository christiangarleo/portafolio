-- Review migration: apply only with production authorization. No history rewrite.
begin;
alter table public.portfolio_crm_mail drop constraint portfolio_crm_mail_sender_check,
 add constraint portfolio_crm_mail_sender_check check (sender in ('hola@christianarleo.com','correo@christianarleo.com'));

create function public.reserve_portfolio_crm_mail(p_id uuid,p_lead uuid,p_actor uuid,p_subject text,p_body text,p_context text,p_sender text,p_reply uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare target public.portfolio_cv_leads%rowtype;
declare prior public.portfolio_crm_mail%rowtype;
declare original_recipients text[];
declare address text;
begin
 if current_user<>'service_role' then raise exception 'forbidden'; end if;
 if not exists(select 1 from public.portfolio_cv_admins where user_id=p_actor) then return jsonb_build_object('status','forbidden');end if;
 if p_sender is null or p_sender not in ('hola@christianarleo.com','correo@christianarleo.com') then return jsonb_build_object('status','invalid_sender');end if;
 if p_context is null or p_context not in ('rejection','followup') then return jsonb_build_object('status','invalid');end if;
 perform pg_advisory_xact_lock(120039871,20261127);
 select * into prior from public.portfolio_crm_mail where id=p_id;
 if found then
   if prior.lead_id is distinct from p_lead or prior.actor_id is distinct from p_actor or prior.sender is distinct from p_sender or prior.subject is distinct from p_subject or prior.body is distinct from p_body or prior.context is distinct from p_context or prior.in_reply_to is distinct from p_reply then return jsonb_build_object('status','conflict'); end if;
   return jsonb_build_object('status',prior.status,'existing',true);
 end if;
 select * into target from public.portfolio_cv_leads where id=p_lead;
 if not found then return jsonb_build_object('status','unavailable'); end if;

 if target.contact_preference='empresa_contacta' and target.contact_override_at is null then return jsonb_build_object('status','contact_blocked'); end if;
 if (p_context='rejection' and target.decision_status is distinct from 'rechazada') or (p_context='followup' and target.decision_status is distinct from 'avanzar') then return jsonb_build_object('status','decision_changed'); end if;
 address=lower(btrim(target.email));
 if address is null or char_length(address)>254 or address !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+[.][^[:space:]@,;<>]+$' then return jsonb_build_object('status','invalid_email');end if;
 if p_reply is not null then
  select recipients into original_recipients from public.portfolio_crm_inbound where id=p_reply and lower(btrim(sender))=address and lead_id=p_lead;
  if not found then return jsonb_build_object('status','invalid_reply');end if;
  if (('hola@christianarleo.com'=ANY(original_recipients)) IS TRUE) <> (('correo@christianarleo.com'=ANY(original_recipients)) IS TRUE)
     and (p_sender=ANY(original_recipients)) IS NOT TRUE then return jsonb_build_object('status','sender_mismatch');end if;
 end if;

 if (select count(*) from public.portfolio_crm_mail where created_at>clock_timestamp()-interval '24 hours')>=10 then return jsonb_build_object('status','limit'); end if;
 if exists(select 1 from public.portfolio_crm_mail where (lead_id=p_lead or lower(recipient)=address) and status in ('pending','uncertain') and created_at>clock_timestamp()-interval '24 hours') then return jsonb_build_object('status','uncertain_previous'); end if;
 if exists(select 1 from public.portfolio_crm_mail where lower(recipient)=address and sender=p_sender and subject=p_subject and body=p_body and status='accepted' and created_at>clock_timestamp()-interval '10 minutes') then return jsonb_build_object('status','duplicate'); end if;
 insert into public.portfolio_crm_mail(id,lead_id,actor_id,recipient,sender,subject,body,context,in_reply_to) values(p_id,p_lead,p_actor,address,p_sender,p_subject,p_body,p_context,p_reply);
 return jsonb_build_object('status','reserved','recipient',address,'sender',p_sender);
end $$;
revoke all on function public.reserve_portfolio_crm_mail(uuid,uuid,uuid,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.reserve_portfolio_crm_mail(uuid,uuid,uuid,text,text,text,text,uuid) to service_role;

create function public.reserve_portfolio_crm_general_mail(p_id uuid,p_actor uuid,p_recipient text,p_subject text,p_body text,p_reply uuid,p_sender text)
returns jsonb language plpgsql security invoker set search_path='pg_catalog' as $$
declare target_id uuid; declare prior public.portfolio_crm_mail%rowtype; declare address text; declare n int; declare original_recipients text[];
begin
 if current_user<>'service_role' then raise exception 'forbidden'; end if;
 if not exists(select 1 from public.portfolio_cv_admins where user_id=p_actor) then return jsonb_build_object('status','forbidden'); end if;
 if p_sender is null or p_sender not in ('hola@christianarleo.com','correo@christianarleo.com') then return jsonb_build_object('status','invalid_sender');end if;
 perform pg_advisory_xact_lock(120039871,20261127);
 address=lower(btrim(p_recipient));
 if address is null or char_length(address)>254 or address !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+[.][^[:space:]@,;<>]+$' then return jsonb_build_object('status','invalid_email');end if;
 if p_reply is not null then
  select recipients into original_recipients from public.portfolio_crm_inbound where id=p_reply and lower(btrim(sender))=address;
  if not found then return jsonb_build_object('status','invalid_reply');end if;
  if (('hola@christianarleo.com'=ANY(original_recipients)) IS TRUE) <> (('correo@christianarleo.com'=ANY(original_recipients)) IS TRUE)
     and (p_sender=ANY(original_recipients)) IS NOT TRUE then return jsonb_build_object('status','sender_mismatch');end if;
 end if;

 select * into prior from public.portfolio_crm_mail where id=p_id;
 if found then
  if prior.actor_id is distinct from p_actor or prior.sender is distinct from p_sender or prior.context<>'general' or lower(prior.recipient)<>address or prior.subject<>p_subject or prior.body<>p_body or prior.in_reply_to is distinct from p_reply then return jsonb_build_object('status','conflict');end if;
  return jsonb_build_object('status',prior.status,'existing',true);
 end if;
 if exists(select 1 from public.portfolio_cv_leads where lower(btrim(email))=address and contact_preference='empresa_contacta' and contact_override_at is null) then return jsonb_build_object('status','contact_blocked');end if;
 if exists(select 1 from public.portfolio_cv_leads where lower(btrim(email))=address and coalesce(decision_status,'pendiente') not in ('avanzar','rechazada')) then return jsonb_build_object('status','decision_changed');end if;
 select count(*) into n from public.portfolio_cv_leads where lower(btrim(email))=address;
 if n=1 then select id into target_id from public.portfolio_cv_leads where lower(btrim(email))=address;end if;
 if (select count(*) from public.portfolio_crm_mail where created_at>clock_timestamp()-interval '24 hours')>=10 then return jsonb_build_object('status','limit');end if;
 if exists(select 1 from public.portfolio_crm_mail where lower(recipient)=address and status in ('pending','uncertain') and created_at>clock_timestamp()-interval '24 hours') then return jsonb_build_object('status','uncertain_previous');end if;
 if exists(select 1 from public.portfolio_crm_mail where lower(recipient)=address and sender=p_sender and subject=p_subject and body=p_body and status='accepted' and created_at>clock_timestamp()-interval '10 minutes') then return jsonb_build_object('status','duplicate');end if;
 insert into public.portfolio_crm_mail(id,lead_id,actor_id,recipient,sender,subject,body,context,in_reply_to) values(p_id,target_id,p_actor,address,p_sender,p_subject,p_body,'general',p_reply);
 return jsonb_build_object('status','reserved','recipient',address,'sender',p_sender);
end $$;
revoke all on function public.reserve_portfolio_crm_general_mail(uuid,uuid,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_portfolio_crm_general_mail(uuid,uuid,text,text,text,uuid,text) to service_role;

commit;
