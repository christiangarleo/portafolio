begin;
alter table public.portfolio_crm_mail add column reply_address text unique check (reply_address is null or reply_address ~ '^reply-[a-f0-9-]{36}@respuestas\.christianarleo\.com$');
create table public.portfolio_crm_inbound (
 id uuid primary key default gen_random_uuid(),
 provider_email_id uuid not null unique,
 outbound_id uuid not null references public.portfolio_crm_mail(id) on delete cascade,
 lead_id uuid not null references public.portfolio_cv_leads(id) on delete cascade,
 sender text not null check(char_length(sender)<=320),
 subject text not null check(char_length(subject)<=500),
 body text not null check(char_length(body)<=20000),
 body_limited boolean not null default false,
 received_at timestamptz not null default now(),
 read_at timestamptz
);
create index portfolio_crm_inbound_lead_time on public.portfolio_crm_inbound(lead_id,received_at desc);
create index portfolio_crm_inbound_unread on public.portfolio_crm_inbound(lead_id) where read_at is null;
alter table public.portfolio_crm_inbound enable row level security;
revoke all on public.portfolio_crm_inbound from public,anon,authenticated;
grant select,update(read_at) on public.portfolio_crm_inbound to authenticated;
grant select,insert on public.portfolio_crm_inbound to service_role;
create policy "Approved admins read inbound mail" on public.portfolio_crm_inbound for select to authenticated using
(exists(select 1 from public.portfolio_cv_admins a where a.user_id=(select auth.uid()) and lower(a.approved_email)=lower((select auth.jwt()->>'email'))));
create policy "Approved admins mark inbound read" on public.portfolio_crm_inbound for update to authenticated using
(exists(select 1 from public.portfolio_cv_admins a where a.user_id=(select auth.uid()) and lower(a.approved_email)=lower((select auth.jwt()->>'email'))))
with check(exists(select 1 from public.portfolio_cv_admins a where a.user_id=(select auth.uid()) and lower(a.approved_email)=lower((select auth.jwt()->>'email'))));
commit;
