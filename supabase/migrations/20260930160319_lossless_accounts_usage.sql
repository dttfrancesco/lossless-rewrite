create table public.lossless_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 plan text not null default 'free' check (plan in ('free','plus','pro')),
 stripe_customer_id text unique, stripe_subscription_id text unique,
 paid_until timestamptz, created_at timestamptz not null default now()
);
create table public.lossless_usage (
 user_id uuid not null references public.lossless_accounts(user_id) on delete cascade,
 month date not null, used integer not null default 0 check (used>=0),
 primary key(user_id,month)
);
create table public.lossless_checks (
 user_id uuid not null references public.lossless_accounts(user_id) on delete cascade,
 request_id uuid not null, month date not null, credits integer not null check(credits between 1 and 10),
 state text not null default 'reserved' check(state in ('reserved','complete','failed')),
 input_tokens integer, created_at timestamptz not null default now(), primary key(user_id,request_id)
);
create index lossless_checks_recent on public.lossless_checks(user_id,created_at desc);
alter table public.lossless_accounts enable row level security;
alter table public.lossless_usage enable row level security;
alter table public.lossless_checks enable row level security;
revoke all on public.lossless_accounts,public.lossless_usage,public.lossless_checks from anon,authenticated;
grant all on public.lossless_accounts,public.lossless_usage,public.lossless_checks to service_role;
create function public.lossless_reserve(p_user uuid,p_request uuid,p_credits integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare m date:=date_trunc('month',now() at time zone 'UTC')::date; a public.lossless_accounts; u public.lossless_usage; allowance integer; recent integer;
begin
 if p_credits<1 or p_credits>10 then raise exception 'Invalid check size'; end if;
 insert into public.lossless_accounts(user_id) values(p_user) on conflict do nothing;
 select * into a from public.lossless_accounts where user_id=p_user for update;
 if exists(select 1 from public.lossless_checks where user_id=p_user and request_id=p_request) then raise exception 'Request already used'; end if;
 select count(*) into recent from public.lossless_checks where user_id=p_user and created_at>now()-interval '1 hour';
 if recent>=240 then raise exception 'Hourly limit reached'; end if;
 if exists(select 1 from public.lossless_checks where user_id=p_user and state='reserved' and created_at>now()-interval '2 minutes') then raise exception 'A check is running'; end if;
 allowance:=case when a.paid_until>now() and a.plan='pro' then 2000 when a.paid_until>now() and a.plan='plus' then 500 else 25 end;
 insert into public.lossless_usage(user_id,month) values(p_user,m) on conflict do nothing;
 select * into u from public.lossless_usage where user_id=p_user and month=m for update;
 if u.used+p_credits>allowance then raise exception 'Monthly allowance reached'; end if;
 update public.lossless_usage set used=used+p_credits where user_id=p_user and month=m;
 insert into public.lossless_checks(user_id,request_id,month,credits) values(p_user,p_request,m,p_credits);
 return jsonb_build_object('used',u.used+p_credits,'allowance',allowance,'credits',p_credits);
end $$;
create function public.lossless_finish(p_user uuid,p_request uuid,p_success boolean,p_tokens integer default 0) returns void language plpgsql security invoker set search_path='' as $$
declare r public.lossless_checks;
begin
 select * into r from public.lossless_checks where user_id=p_user and request_id=p_request for update;
 if not found or r.state<>'reserved' then return; end if;
 update public.lossless_checks set state=case when p_success then 'complete' else 'failed' end,input_tokens=greatest(0,p_tokens) where user_id=p_user and request_id=p_request;
 if not p_success then update public.lossless_usage set used=greatest(0,used-r.credits) where user_id=p_user and month=r.month; end if;
end $$;
revoke all on function public.lossless_reserve(uuid,uuid,integer),public.lossless_finish(uuid,uuid,boolean,integer) from public,anon,authenticated;
grant execute on function public.lossless_reserve(uuid,uuid,integer),public.lossless_finish(uuid,uuid,boolean,integer) to service_role;
