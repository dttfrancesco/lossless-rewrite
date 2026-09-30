-- Free launch: collect explicit plan interest; owner access is independent of billing.
create table public.lossless_plan_interest (
 user_id uuid not null references auth.users(id) on delete cascade,
 plan text not null check(plan in ('plus','pro')),
 email text not null, consent_version text not null default 'plan-launch-v1',
 created_at timestamptz not null default now(), primary key(user_id,plan)
);
create table public.lossless_owner_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(), revoked_at timestamptz
);
create table public.lossless_access_codes (
 code_hash text primary key check(code_hash ~ '^[0-9a-f]{64}$'),
 email text not null check(email=lower(btrim(email))),
 expires_at timestamptz not null,
 redeemed_by uuid references auth.users(id) on delete set null,
 redeemed_at timestamptz, created_at timestamptz not null default now()
);
alter table public.lossless_plan_interest enable row level security;
alter table public.lossless_owner_access enable row level security;
alter table public.lossless_access_codes enable row level security;
revoke all on public.lossless_plan_interest,public.lossless_owner_access,public.lossless_access_codes from public,anon,authenticated;
grant all on public.lossless_plan_interest,public.lossless_owner_access,public.lossless_access_codes to service_role;
create function public.lossless_redeem_owner(p_user uuid,p_hash text) returns void language plpgsql security invoker set search_path='' as $$
declare c public.lossless_access_codes; verified_email text;
begin
 select lower(email) into verified_email from auth.users where id=p_user and email_confirmed_at is not null;
 select * into c from public.lossless_access_codes where code_hash=p_hash for update;
 if not found or c.email is distinct from verified_email or c.expires_at<=now() or c.redeemed_at is not null then
   raise exception 'Code is invalid, expired, used, or belongs to another account';
 end if;
 insert into public.lossless_owner_access(user_id) values(p_user) on conflict(user_id) do update set revoked_at=null;
 update public.lossless_access_codes set redeemed_by=p_user,redeemed_at=now() where code_hash=p_hash;
end $$;
revoke all on function public.lossless_redeem_owner(uuid,text) from public,anon,authenticated;
grant execute on function public.lossless_redeem_owner(uuid,text) to service_role;
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
 select exists(select 1 from public.lossless_owner_access where user_id=p_user and revoked_at is null) into owner_access;
 allowance:=case when owner_access then null else 25 end;
 insert into public.lossless_usage(user_id,month) values(p_user,m) on conflict do nothing;
 select * into u from public.lossless_usage where user_id=p_user and month=m for update;
 if u.used+p_credits>allowance then raise exception 'Monthly allowance reached'; end if;
 update public.lossless_usage set used=used+p_credits where user_id=p_user and month=m;
 insert into public.lossless_checks(user_id,request_id,month,credits) values(p_user,p_request,m,p_credits);
 return jsonb_build_object('used',u.used+p_credits,'allowance',allowance,'credits',p_credits);
end $$;
