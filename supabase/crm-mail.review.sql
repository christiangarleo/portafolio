-- Review only; no live migration applied.
begin;
create table public.portfolio_crm_mail (
 id uuid primary key,
 lead_id uuid not null references public.portfolio_cv_leads(id) on delete cascade,
 actor_id uuid not null,
 recipient text not null,
 sender text not null check (sender='hola@christianarleo.com'),
 subject text not null check (char_length(subject) between 1 and 180),
 body text not null check (char_length(body) between 1 and 5000),
 context text not null check (context in ('rejection','followup')),
 status text not null default 'pending' check (status in ('pending','accepted','failed','uncertain')),
 provider_id text,
 created_at timestamptz not null default now(),
 accepted_at timestamptz
);
create index portfolio_crm_mail_lead_time on public.portfolio_crm_mail(lead_id,created_at desc);
create index portfolio_crm_mail_time on public.portfolio_crm_mail(created_at);
alter table public.portfolio_crm_mail enable row level security;
revoke all on public.portfolio_crm_mail from public,anon,authenticated;
grant select on public.portfolio_crm_mail to authenticated;
grant select,insert,update on public.portfolio_crm_mail to service_role;
create policy "Approved admins read CRM mail" on public.portfolio_crm_mail for select to authenticated
using (exists (select 1 from public.portfolio_cv_admins a where a.user_id=(select auth.uid()) and lower(a.approved_email)=lower((select auth.jwt()->>'email'))));
create function public.reserve_portfolio_crm_mail(p_id uuid,p_lead uuid,p_actor uuid,p_subject text,p_body text,p_context text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare target public.portfolio_cv_leads%rowtype;
declare prior public.portfolio_crm_mail%rowtype;
begin
 if current_user<>'service_role' then raise exception 'forbidden'; end if;
 perform pg_advisory_xact_lock(120039871,20261127);
 select * into prior from public.portfolio_crm_mail where id=p_id;
 if found then
   if prior.lead_id<>p_lead or prior.actor_id<>p_actor then return jsonb_build_object('status','conflict'); end if;
   return jsonb_build_object('status',prior.status,'existing',true);
 end if;
 select * into target from public.portfolio_cv_leads where id=p_lead;
 if not found then return jsonb_build_object('status','unavailable'); end if;
 if not exists(select 1 from public.portfolio_cv_admins where user_id=p_actor) then return jsonb_build_object('status','forbidden'); end if;
 if target.contact_preference='empresa_contacta' and target.contact_override_at is null then return jsonb_build_object('status','contact_blocked'); end if;
 if (p_context='rejection' and target.decision_status<>'rechazada') or (p_context='followup' and target.decision_status<>'avanzar') then return jsonb_build_object('status','decision_changed'); end if;
 if target.email !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$' then return jsonb_build_object('status','invalid_email'); end if;
 if (select count(*) from public.portfolio_crm_mail where created_at>clock_timestamp()-interval '24 hours')>=10 then return jsonb_build_object('status','limit'); end if;
 if exists(select 1 from public.portfolio_crm_mail where lead_id=p_lead and status in ('pending','uncertain') and created_at>clock_timestamp()-interval '24 hours') then return jsonb_build_object('status','uncertain_previous'); end if;
 if exists(select 1 from public.portfolio_crm_mail where lead_id=p_lead and subject=p_subject and body=p_body and status='accepted' and created_at>clock_timestamp()-interval '10 minutes') then return jsonb_build_object('status','duplicate'); end if;
 insert into public.portfolio_crm_mail(id,lead_id,actor_id,recipient,sender,subject,body,context) values(p_id,p_lead,p_actor,target.email,'hola@christianarleo.com',p_subject,p_body,p_context);
 return jsonb_build_object('status','reserved','recipient',target.email);
end $$;
revoke all on function public.reserve_portfolio_crm_mail(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_portfolio_crm_mail(uuid,uuid,uuid,text,text,text) to service_role;
commit;
