-- Row-level-security isolation test (Phase 1 · M1).
-- Proves the core multi-tenancy guarantee: no cross-tenant data leakage.
--
-- Run against a Supabase DB that already has schema.sql applied, e.g.:
--   psql "$SUPABASE_DB_URL" -f packages/db/test/rls.test.sql
-- Runs entirely inside a transaction and ROLLs BACK — it leaves no fixtures behind.
-- Prints "RLS TEST PASSED" on success; raises (and aborts) on the first failure.

begin;

-- Fixtures are inserted as the table owner (RLS bypassed) ------------------------
set local role postgres;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin-a@test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'viewer-b@test');

insert into public.tenants (id, name) values
  ('11111111-0000-0000-0000-000000000001', 'Tenant A'),
  ('22222222-0000-0000-0000-000000000002', 'Tenant B');

insert into public.users (id, tenant_id, email, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'admin-a@test',  'admin'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'viewer-b@test', 'client-viewer');

insert into public.clients (id, tenant_id, name, slug) values
  ('cccccccc-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000001', 'A One', 'a-one'),
  ('cccccccc-0000-0000-0000-00000000000b', '11111111-0000-0000-0000-000000000001', 'A Two', 'a-two'),
  ('dddddddd-0000-0000-0000-00000000000c', '22222222-0000-0000-0000-000000000002', 'B One', 'b-one');

-- viewer-b is joined ONLY to B One
insert into public.user_clients (user_id, client_id, role) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-00000000000c', 'client-viewer');

-- Helper to impersonate a user the way Supabase does (jwt 'sub' = user id) -------
-- Each test: become 'authenticated', set the claim, assert, then reset.

-- TEST 1: admin of Tenant A sees exactly their 2 clients, never Tenant B's -------
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
declare n int; leaked int;
begin
  select count(*) into n      from public.clients;
  select count(*) into leaked from public.clients where tenant_id = '22222222-0000-0000-0000-000000000002';
  if n <> 2     then raise exception 'TEST 1 FAIL: admin-A saw % clients, expected 2', n; end if;
  if leaked > 0 then raise exception 'TEST 1 FAIL: admin-A leaked % Tenant-B client(s)', leaked; end if;
end $$;
reset role;

-- TEST 2: client-viewer of Tenant B sees ONLY the one client they're joined to ---
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';
do $$
declare n int; saw_a int;
begin
  select count(*) into n     from public.clients;
  select count(*) into saw_a from public.clients where tenant_id = '11111111-0000-0000-0000-000000000001';
  if n <> 1    then raise exception 'TEST 2 FAIL: viewer-B saw % clients, expected 1', n; end if;
  if saw_a > 0 then raise exception 'TEST 2 FAIL: viewer-B leaked % Tenant-A client(s)', saw_a; end if;
end $$;
reset role;

-- TEST 3: tenant visibility is scoped — admin-A sees only Tenant A ----------------
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from public.tenants;
  if n <> 1 then raise exception 'TEST 3 FAIL: admin-A saw % tenants, expected 1', n; end if;
end $$;
reset role;

-- TEST 4: an admin cannot write into another tenant (WITH CHECK) -----------------
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
  if not ok then raise exception 'TEST 4 FAIL: admin-A inserted a client into Tenant B'; end if;
end $$;
reset role;

do $$ begin raise notice 'RLS TEST PASSED'; end $$;

rollback;
