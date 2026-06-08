-- Row-level-security isolation test (Phase 1 · M1).
-- Proves the core multi-tenancy guarantee AND the highest-risk property in the
-- whole build (brief v4.0 §3b): a Type-4 (client_signal / CMO) user can never
-- reach another client's data. No cross-tenant, no cross-client leakage.
--
-- Run against a Supabase DB that already has schema.sql applied, e.g.:
--   psql "$SUPABASE_DB_URL" -f packages/db/test/rls.test.sql
-- Runs entirely inside a transaction and ROLLs BACK — it leaves no fixtures behind.
-- Prints "RLS TEST PASSED" on success; raises (and aborts) on the first failure.

begin;

-- Fixtures are inserted as the table owner (RLS bypassed) ------------------------
set local role postgres;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'operator-a@test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'cmo-b@test'),
  ('cccccccc-0000-0000-0000-000000000003', 'cmo-a2@test');

insert into public.tenants (id, name) values
  ('11111111-0000-0000-0000-000000000001', 'Tenant A'),
  ('22222222-0000-0000-0000-000000000002', 'Tenant B');

insert into public.users (id, tenant_id, email, role, can_sign_off) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'operator-a@test', 'in_house',      true),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'cmo-b@test',      'client_signal', false),
  ('cccccccc-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'cmo-a2@test',     'client_signal', false);

insert into public.clients (id, tenant_id, name, slug) values
  ('dddddddd-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000001', 'A One', 'a-one'),
  ('dddddddd-0000-0000-0000-00000000000b', '11111111-0000-0000-0000-000000000001', 'A Two', 'a-two'),
  ('eeeeeeee-0000-0000-0000-00000000000c', '22222222-0000-0000-0000-000000000002', 'B One', 'b-one');

-- cmo-b (Tenant B) is a Signal-only user joined ONLY to B One
insert into public.user_clients (user_id, client_id, role) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-00000000000c', 'client_signal');
-- NOTE: cmo-a2 (Tenant A) is deliberately joined to NOTHING — default-deny check.

-- Helper to impersonate a user the way Supabase does (jwt 'sub' = user id) -------
-- Each test: become 'authenticated', set the claim, assert, then reset.

-- TEST 1: in_house operator of Tenant A sees exactly their 2 clients, never B's --
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
declare n int; leaked int;
begin
  select count(*) into n      from public.clients;
  select count(*) into leaked from public.clients where tenant_id = '22222222-0000-0000-0000-000000000002';
  if n <> 2     then raise exception 'TEST 1 FAIL: operator-A saw % clients, expected 2', n; end if;
  if leaked > 0 then raise exception 'TEST 1 FAIL: operator-A leaked % Tenant-B client(s)', leaked; end if;
end $$;
reset role;

-- TEST 2 (CATASTROPHIC-LEAK SURFACE): a Type-4 CMO sees ONLY the one client -------
-- they're joined to — never another client, never another tenant.
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';
do $$
declare n int; saw_a int; saw_name text;
begin
  select count(*) into n     from public.clients;
  select count(*) into saw_a from public.clients where tenant_id = '11111111-0000-0000-0000-000000000001';
  select string_agg(slug, ',') into saw_name from public.clients;
  if n <> 1            then raise exception 'TEST 2 FAIL: CMO-B saw % clients (%), expected 1 (b-one)', n, saw_name; end if;
  if saw_a > 0         then raise exception 'TEST 2 FAIL: CMO-B leaked % Tenant-A client(s)', saw_a; end if;
  if saw_name <> 'b-one' then raise exception 'TEST 2 FAIL: CMO-B saw "%", expected only b-one', saw_name; end if;
end $$;
reset role;

-- TEST 3: a Type-4 user joined to NO client sees ZERO clients (default-deny) -------
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from public.clients;
  if n <> 0 then raise exception 'TEST 3 FAIL: unassigned CMO saw % clients, expected 0', n; end if;
end $$;
reset role;

-- TEST 4: tenant visibility is scoped — operator-A sees only Tenant A -------------
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from public.tenants;
  if n <> 1 then raise exception 'TEST 4 FAIL: operator-A saw % tenants, expected 1', n; end if;
end $$;
reset role;

-- TEST 5: a non-admin cannot write a client at all (write is in_house-only) -------
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';
do $$
declare ok boolean := false;
begin
  begin
    insert into public.clients (tenant_id, name, slug)
    values ('22222222-0000-0000-0000-000000000002', 'Sneaky', 'sneaky');
  exception when others then
    ok := true;  -- expected: RLS blocks a Type-4 user from writing clients
  end;
  if not ok then raise exception 'TEST 5 FAIL: a client_signal user inserted a client'; end if;
end $$;
reset role;

-- TEST 6: an in_house operator cannot write into another tenant (WITH CHECK) ------
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
declare ok boolean := false;
begin
  begin
    insert into public.clients (tenant_id, name, slug)
    values ('22222222-0000-0000-0000-000000000002', 'Sneaky', 'sneaky');
  exception when others then
    ok := true;  -- expected: RLS WITH CHECK blocks the cross-tenant insert
  end;
  if not ok then raise exception 'TEST 6 FAIL: operator-A inserted a client into Tenant B'; end if;
end $$;
reset role;

do $$ begin raise notice 'RLS TEST PASSED'; end $$;

rollback;
