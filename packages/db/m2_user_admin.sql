-- Trifecta Platform — M2 user-management policies. Apply AFTER schema.sql.
--   psql "$SUPABASE_DB_URL" -f packages/db/m2_user_admin.sql   (idempotent)
--
-- M1 let a user update only their OWN profile (users_self_update). M2 needs an
-- in_house operator to manage their team — set another user's role, can_sign_off,
-- or full_name — within their tenant. This adds that capability via RLS, so the
-- admin screens work through the operator's own session (no service key needed for
-- role changes; only inviting a brand-new auth user needs the secret key).

drop policy if exists users_admin_update on public.users;
create policy users_admin_update on public.users
  for update using (public.is_admin() and tenant_id = public.current_tenant_id())
          with check (public.is_admin() and tenant_id = public.current_tenant_id());

-- in_house may also read every profile in the tenant (already covered by
-- users_self_select, kept here as documentation of intent).
