-- Bearer tokens are emailed; only their SHA-256 hashes are retained.
alter table public.lossless_interest_mail add column unsubscribe_hash text;
create unique index lossless_interest_mail_id_key on public.lossless_interest_mail(id);
comment on column public.lossless_interest_mail.unsubscribe_hash is 'Hashed plan-scoped unsubscribe token. Null for confirmations sent before direct unsubscribe was added.';
