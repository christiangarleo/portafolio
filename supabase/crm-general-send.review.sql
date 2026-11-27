begin;
alter table public.portfolio_crm_mail alter column lead_id drop not null,
 drop constraint portfolio_crm_mail_context_check,
 add constraint portfolio_crm_mail_context_check check(context in ('rejection','followup','general')),
 drop constraint portfolio_crm_mail_lead_id_fkey,
 add constraint portfolio_crm_mail_lead_id_fkey foreign key(lead_id) references public.portfolio_cv_leads(id) on delete set null,
 add column in_reply_to uuid references public.portfolio_crm_inbound(id) on delete set null;
create function public.reserve_portfolio_crm_general_mail(p_id uuid,p_actor uuid,p_recipient text,p_subject text,p_body text,p_reply uuid default null)
returns jsonb language plpgsql security invoker set search_path='pg_catalog' as $$
declare target_id uuid; declare prior public.portfolio_crm_mail%rowtype; declare address text; declare n int;
begin
 if current_user<>'service_role' then raise exception 'forbidden'; end if;
 if not exists(select 1 from public.portfolio_cv_admins where user_id=p_actor) then return jsonb_build_object('status','forbidden'); end if;
 perform pg_advisory_xact_lock(120039871,20261127);
 address=lower(btrim(p_recipient));
 if address is null or char_length(address)>254 or address !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+[.][^[:space:]@,;<>]+$' then return jsonb_build_object('status','invalid_email');end if;
 if p_reply is not null and not exists(select 1 from public.portfolio_crm_inbound where id=p_reply and lower(btrim(sender))=address) then return jsonb_build_object('status','invalid_reply');end if;
 select * into prior from public.portfolio_crm_mail where id=p_id;
 if found then
  if prior.actor_id<>p_actor or prior.context<>'general' or lower(prior.recipient)<>address or prior.subject<>p_subject or prior.body<>p_body or prior.in_reply_to is distinct from p_reply then return jsonb_build_object('status','conflict');end if;
  return jsonb_build_object('status',prior.status,'existing',true);
 end if;
 if exists(select 1 from public.portfolio_cv_leads where lower(btrim(email))=address and contact_preference='empresa_contacta' and contact_override_at is null) then return jsonb_build_object('status','contact_blocked');end if;
 if exists(select 1 from public.portfolio_cv_leads where lower(btrim(email))=address and coalesce(decision_status,'pendiente') not in ('avanzar','rechazada')) then return jsonb_build_object('status','decision_changed');end if;
 select count(*) into n from public.portfolio_cv_leads where lower(btrim(email))=address;
 if n=1 then select id into target_id from public.portfolio_cv_leads where lower(btrim(email))=address;end if;
 if (select count(*) from public.portfolio_crm_mail where created_at>clock_timestamp()-interval '24 hours')>=10 then return jsonb_build_object('status','limit');end if;
 if exists(select 1 from public.portfolio_crm_mail where lower(recipient)=address and status in ('pending','uncertain') and created_at>clock_timestamp()-interval '24 hours') then return jsonb_build_object('status','uncertain_previous');end if;
 if exists(select 1 from public.portfolio_crm_mail where lower(recipient)=address and subject=p_subject and body=p_body and status='accepted' and created_at>clock_timestamp()-interval '10 minutes') then return jsonb_build_object('status','duplicate');end if;
 insert into public.portfolio_crm_mail(id,lead_id,actor_id,recipient,sender,subject,body,context,in_reply_to) values(p_id,target_id,p_actor,address,'hola@christianarleo.com',p_subject,p_body,'general',p_reply);
 return jsonb_build_object('status','reserved','recipient',address);
end $$;
revoke all on function public.reserve_portfolio_crm_general_mail(uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.reserve_portfolio_crm_general_mail(uuid,uuid,text,text,text,uuid) to service_role;
commit;