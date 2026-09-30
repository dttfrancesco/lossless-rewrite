-- One confirmation per account/plan. Retained after withdrawal so repeated
-- join/remove requests cannot turn the interest endpoint into an email sender.
create table public.lossless_interest_mail (
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('plus','pro')),
  id uuid not null default gen_random_uuid(),
  status text not null default 'sending' check (status in ('sending','sent','failed','unknown')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_id text,
  error_code text,
  primary key (user_id,plan)
);
alter table public.lossless_interest_mail enable row level security;
revoke all on public.lossless_interest_mail from public, anon, authenticated;
grant select,insert,update,delete on public.lossless_interest_mail to service_role;
