begin;
alter table public.portfolio_crm_inbound
 alter column lead_id drop not null,
 alter column outbound_id drop not null,
 drop constraint portfolio_crm_inbound_lead_id_fkey,
 drop constraint portfolio_crm_inbound_outbound_id_fkey,
 add constraint portfolio_crm_inbound_lead_id_fkey foreign key(lead_id) references public.portfolio_cv_leads(id) on delete set null,
 add constraint portfolio_crm_inbound_outbound_id_fkey foreign key(outbound_id) references public.portfolio_crm_mail(id) on delete set null,
 add column recipients text[] not null default '{}'::text[] check(cardinality(recipients)<=100),
 add column attachment_count integer not null default 0 check(attachment_count>=0);
update public.portfolio_crm_inbound i set recipients=array[o.reply_address] from public.portfolio_crm_mail o where o.id=i.outbound_id and o.reply_address is not null;
create index portfolio_crm_inbound_received on public.portfolio_crm_inbound(received_at desc,id desc);
commit;