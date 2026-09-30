create table public.lossless_owner_allowlist (
 email text primary key check(email=lower(btrim(email))),
 user_id uuid unique references auth.users(id) on delete set null,
 enabled boolean not null default true, created_at timestamptz not null default now()
);
alter table public.lossless_owner_allowlist enable row level security;
revoke all on public.lossless_owner_allowlist from public,anon,authenticated;
grant all on public.lossless_owner_allowlist to service_role;
create or replace function public.lossless_reserve(p_user uuid,p_request uuid,p_credits integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare m date:=date_trunc('month',now() at time zone 'UTC')::date; a public.lossless_accounts; u public.lossless_usage; allowance integer; recent integer; owner_access boolean;
begin
 if p_credits<1 or p_credits>10 then raise exception 'Invalid check size'; end if;
 insert into public.lossless_accounts(user_id) values(p_user) on conflict do nothing;
 select * into a from public.lossless_accounts where user_id=p_user for update;
 if exists(select 1 from public.lossless_checks where user_id=p_user and request_id=p_request) then raise exception 'Request already used'; end if;
 select count(*) into recent from public.lossless_checks where user_id=p_user and created_at>now()-interval '1 hour';
 if recent>=240 then raise exception 'Hourly limit reached'; end if;
 if exists(select 1 from public.lossless_checks where user_id=p_user and state='reserved' and created_at>now()-interval '2 minutes') then raise exception 'A check is running'; end if;
 select exists(select 1 from public.lossless_owner_allowlist where user_id=p_user and enabled) into owner_access;
 allowance:=case when owner_access then null else 25 end;
 insert into public.lossless_usage(user_id,month) values(p_user,m) on conflict do nothing;
 select * into u from public.lossless_usage where user_id=p_user and month=m for update;
 if u.used+p_credits>allowance then raise exception 'Monthly allowance reached'; end if;
 update public.lossless_usage set used=used+p_credits where user_id=p_user and month=m;
 insert into public.lossless_checks(user_id,request_id,month,credits) values(p_user,p_request,m,p_credits);
 return jsonb_build_object('used',u.used+p_credits,'allowance',allowance,'credits',p_credits);
end $$;

drop function public.lossless_redeem_owner(uuid,text,text);
drop table public.lossless_access_codes;
drop table public.lossless_owner_access;
