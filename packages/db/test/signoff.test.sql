-- Sign-off gate test (Phase 1 · M4/M5) — brief v4.0 §9 high-stakes area #2.
-- Proves the database itself enforces: fitter ≠ reviewer, only-seniors-sign-off,
-- sign-off-by-the-reviewer, promote-gated-on-sign-off, and one-live-per-client —
-- plus that Type-4/Type-3 users can't even see model internals.
--
-- Run against a DB with schema.sql AND model_schema.sql applied (Supabase, or any
-- Postgres providing auth.uid()/auth.users):
--   psql "$SUPABASE_DB_URL" -f packages/db/test/signoff.test.sql
-- Runs inside a transaction and ROLLs BACK. Prints "SIGN-OFF TEST PASSED" on success.

begin;

set local role postgres;  -- fixtures as table owner (RLS bypassed)

-- auth users -------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'operator@test'),  -- in_house, senior (can_sign_off)
  ('eeeeeeee-0000-0000-0000-0000000000e1', 'kisholoy@test'),  -- expert, fitter (not senior)
  ('eeeeeeee-0000-0000-0000-0000000000e2', 'expert2@test'),   -- expert, assigned, NOT senior
  ('cccccccc-0000-0000-0000-0000000000c4', 'cmo@test');       -- client_signal (CMO)

insert into public.tenants (id, name) values
  ('11111111-0000-0000-0000-000000000001'::uuid, 'Tenant A');

insert into public.users (id, tenant_id, email, role, can_sign_off) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', '11111111-0000-0000-0000-000000000001', 'operator@test', 'in_house',      true),
  ('eeeeeeee-0000-0000-0000-0000000000e1', '11111111-0000-0000-0000-000000000001', 'kisholoy@test', 'expert',        false),
  ('eeeeeeee-0000-0000-0000-0000000000e2', '11111111-0000-0000-0000-000000000001', 'expert2@test',  'expert',        false),
  ('cccccccc-0000-0000-0000-0000000000c4', '11111111-0000-0000-0000-000000000001', 'cmo@test',      'client_signal', false);

insert into public.clients (id, tenant_id, name, slug) values
  ('22222222-0000-0000-0000-0000000000a1', '11111111-0000-0000-0000-000000000001', 'Client A1', 'a1'),
  ('22222222-0000-0000-0000-0000000000b1', '11111111-0000-0000-0000-000000000001', 'Client B1', 'b1');

-- expert1 + expert2 + cmo are scoped to A1; nobody is assigned to B1.
insert into public.user_clients (user_id, client_id, role) values
  ('eeeeeeee-0000-0000-0000-0000000000e1', '22222222-0000-0000-0000-0000000000a1', 'expert'),
  ('eeeeeeee-0000-0000-0000-0000000000e2', '22222222-0000-0000-0000-0000000000a1', 'expert'),
  ('cccccccc-0000-0000-0000-0000000000c4', '22222222-0000-0000-0000-0000000000a1', 'client_signal');

-- helper aliases (psql \set would need -v; inline the literals instead)

-- TEST 1: fitter ≠ reviewer — a version whose reviewer is its fitter is rejected ----
do $$ declare ok boolean := false; begin
  begin
    insert into public.model_versions (client_id, fitted_by, reviewed_by, label)
    values ('22222222-0000-0000-0000-0000000000a1',
            'eeeeeeee-0000-0000-0000-0000000000e1',
            'eeeeeeee-0000-0000-0000-0000000000e1', 'bad');
  exception when others then ok := true; end;
  if not ok then raise exception 'TEST 1 FAIL: reviewer == fitter was accepted'; end if;
end $$;

-- TEST 2: a new version must start as draft ----------------------------------------
do $$ declare ok boolean := false; begin
  begin
    insert into public.model_versions (client_id, fitted_by, status, label)
    values ('22222222-0000-0000-0000-0000000000a1',
            'eeeeeeee-0000-0000-0000-0000000000e1', 'in_review', 'jump');
  exception when others then ok := true; end;
  if not ok then raise exception 'TEST 2 FAIL: non-draft insert was accepted'; end if;
end $$;

-- Seed a clean draft version fitted by expert1 (kisholoy) for the next tests --------
insert into public.model_versions (id, client_id, fitted_by, label, status)
values ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-0000000000a1',
        'eeeeeeee-0000-0000-0000-0000000000e1', 'v-flow', 'draft');

-- TEST 3: promote-gated — draft cannot jump straight to live -----------------------
do $$ declare ok boolean := false; begin
  begin
    update public.model_versions set status = 'live'
      where id = '33333333-0000-0000-0000-000000000003';
  exception when others then ok := true; end;
  if not ok then raise exception 'TEST 3 FAIL: draft -> live was allowed'; end if;
end $$;

-- Walk it forward through the legal path (owner; no sign-off step yet).
update public.model_versions set status = 'fitting'   where id = '33333333-0000-0000-0000-000000000003';
update public.model_versions set status = 'in_review' where id = '33333333-0000-0000-0000-000000000003';

-- TEST 4: a NON-senior assigned expert cannot sign off -----------------------------
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"eeeeeeee-0000-0000-0000-0000000000e2","role":"authenticated"}';
do $$ declare ok boolean := false; begin
  begin
    update public.model_versions
       set reviewed_by = 'eeeeeeee-0000-0000-0000-0000000000e2', status = 'signed_off'
     where id = '33333333-0000-0000-0000-000000000003';
  exception when others then ok := true; end;
  if not ok then raise exception 'TEST 4 FAIL: a non-senior signed off'; end if;
end $$;
reset role; reset "request.jwt.claims";
set local role postgres;

-- TEST 5: anti-spoof — the fitter cannot sign off by naming a senior as reviewer ----
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"eeeeeeee-0000-0000-0000-0000000000e1","role":"authenticated"}';
do $$ declare ok boolean := false; begin
  begin
    update public.model_versions
       set reviewed_by = 'aaaaaaaa-0000-0000-0000-0000000000a1', status = 'signed_off'
     where id = '33333333-0000-0000-0000-000000000003';
  exception when others then ok := true; end;
  if not ok then raise exception 'TEST 5 FAIL: sign-off was performed by someone other than the reviewer'; end if;
end $$;
reset role; reset "request.jwt.claims";
set local role postgres;

-- TEST 6: the senior reviewer signs off, then it promotes to live (happy path) ------
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated"}';
update public.model_versions
   set reviewed_by = 'aaaaaaaa-0000-0000-0000-0000000000a1', status = 'signed_off'
 where id = '33333333-0000-0000-0000-000000000003';
update public.model_versions set status = 'live'
 where id = '33333333-0000-0000-0000-000000000003';
do $$ declare s text; t timestamptz; begin
  select status, signed_off_at into s, t from public.model_versions
   where id = '33333333-0000-0000-0000-000000000003';
  if s <> 'live'   then raise exception 'TEST 6 FAIL: expected live, got %', s; end if;
  if t is null     then raise exception 'TEST 6 FAIL: signed_off_at was not stamped'; end if;
end $$;
reset role; reset "request.jwt.claims";
set local role postgres;

-- TEST 7: one live version per client — a second cannot also go live ---------------
insert into public.model_versions (id, client_id, fitted_by, label, status)
values ('33333333-0000-0000-0000-000000000007', '22222222-0000-0000-0000-0000000000a1',
        'eeeeeeee-0000-0000-0000-0000000000e1', 'v-second', 'draft');
update public.model_versions set status = 'fitting'   where id = '33333333-0000-0000-0000-000000000007';
update public.model_versions set status = 'in_review' where id = '33333333-0000-0000-0000-000000000007';
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated"}';
update public.model_versions
   set reviewed_by = 'aaaaaaaa-0000-0000-0000-0000000000a1', status = 'signed_off'
 where id = '33333333-0000-0000-0000-000000000007';
do $$ declare ok boolean := false; begin
  begin
    update public.model_versions set status = 'live'
      where id = '33333333-0000-0000-0000-000000000007';
  exception when others then ok := true; end;
  if not ok then raise exception 'TEST 7 FAIL: a second live version was allowed for one client'; end if;
end $$;
reset role; reset "request.jwt.claims";
set local role postgres;

-- TEST 8: RLS — a Type-4 CMO sees NO model internals; an assigned expert does -------
-- CMO (client_signal, joined to A1) must not see model_versions at all.
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"cccccccc-0000-0000-0000-0000000000c4","role":"authenticated"}';
do $$ declare n int; begin
  select count(*) into n from public.model_versions;
  if n <> 0 then raise exception 'TEST 8 FAIL: a Type-4 CMO saw % model version(s)', n; end if;
end $$;
reset role; reset "request.jwt.claims";

-- Assigned expert sees A1's versions, and cannot see unassigned client B1's.
insert into public.model_versions (id, client_id, fitted_by, label, status)
values ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-0000000000b1',
        'eeeeeeee-0000-0000-0000-0000000000e1', 'b-draft', 'draft');
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"eeeeeeee-0000-0000-0000-0000000000e1","role":"authenticated"}';
do $$ declare seen_a int; seen_b int; begin
  select count(*) into seen_a from public.model_versions where client_id = '22222222-0000-0000-0000-0000000000a1';
  select count(*) into seen_b from public.model_versions where client_id = '22222222-0000-0000-0000-0000000000b1';
  if seen_a < 1 then raise exception 'TEST 8 FAIL: assigned expert saw none of their client''s versions'; end if;
  if seen_b <> 0 then raise exception 'TEST 8 FAIL: expert leaked % version(s) from an unassigned client', seen_b; end if;
end $$;
reset role; reset "request.jwt.claims";

do $$ begin raise notice 'SIGN-OFF TEST PASSED'; end $$;

rollback;
