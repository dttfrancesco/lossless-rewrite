-- Verified email comes only from Edge auth.getUser, never the request body.
-- The service-only function needs no privileges on the shared auth.users table.
drop function public.lossless_redeem_owner(uuid,text);
create function public.lossless_redeem_owner(p_user uuid,p_hash text,p_email text) returns void language plpgsql security invoker set search_path='' as $$
declare c public.lossless_access_codes;
begin
 select * into c from public.lossless_access_codes where code_hash=p_hash for update;
 if not found or c.email is distinct from lower(btrim(p_email)) or c.expires_at<=now() or c.redeemed_at is not null then
   raise exception 'Code is invalid, expired, used, or belongs to another account';
 end if;
 insert into public.lossless_owner_access(user_id) values(p_user) on conflict(user_id) do update set revoked_at=null;
 update public.lossless_access_codes set redeemed_by=p_user,redeemed_at=now() where code_hash=p_hash;
end $$;
revoke all on function public.lossless_redeem_owner(uuid,text,text) from public,anon,authenticated;
grant execute on function public.lossless_redeem_owner(uuid,text,text) to service_role;
