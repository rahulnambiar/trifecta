'use client';
// Team & Access — the in-house user-management screen (Phase 1 · M2).
// Lists every user in the tenant, lets an operator set roles / sign-off, scope users
// to clients, invite new users, create clients, and name each client's lead DS.
// All actions hit /api/admin/* (in-house only, RLS-enforced).
import React from 'react';

const ROLES = ['in_house', 'expert', 'client_upload', 'client_signal'];
const ROLE_LABEL = {
  in_house: 'In-house operator',
  expert: 'Expert · Data Scientist',
  client_upload: 'Client · Upload',
  client_signal: 'Client · Signal (CMO)',
};
const ROLE_TAG = { in_house: 'sky', expert: 'mint', client_upload: 'amber', client_signal: 'default' };
const initials = (s) => (s || '?').split(/[\s@.]+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

async function api(path, method, body) {
  const r = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export default function TeamAccess() {
  const [users, setUsers] = React.useState([]);
  const [clients, setClients] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [note, setNote] = React.useState(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [u, c] = await Promise.all([api('/api/admin/users', 'GET'), api('/api/admin/clients', 'GET')]);
      setUsers(u.users || []);
      setClients(c.clients || []);
      setErr(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function mutate(fn, ok) {
    setBusy(true); setErr(null); setNote(null);
    try { await fn(); await load(); if (ok) setNote(ok); }
    catch (e) { setErr(e.message); throw e; }
    finally { setBusy(false); }
  }

  const clientName = (id) => clients.find((c) => c.id === id)?.name || '—';
  const experts = users.filter((u) => u.role === 'in_house' || u.role === 'expert');

  if (loading) return <Card><div className="card-pad dim">Loading team…</div></Card>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {err ? <Banner kind="red">{err}</Banner> : null}
      {note ? <Banner kind="mint">{note}</Banner> : null}

      <InviteForm clients={clients} busy={busy}
        onInvite={(p) => mutate(() => api('/api/admin/users', 'POST', p), `Invited ${p.email}.`)} />

      <Card>
        <div className="card-head">
          <h3>Users <span className="faint mono" style={{ fontSize: 11 }}>· {users.length}</span></h3>
        </div>
        {users.map((u) => (
          <UserRow key={u.id} u={u} clients={clients} clientName={clientName} busy={busy}
            onRole={(role) => mutate(() => api('/api/admin/users', 'PATCH', { id: u.id, role }))}
            onSignoff={() => mutate(() => api('/api/admin/users', 'PATCH', { id: u.id, can_sign_off: !u.can_sign_off }))}
            onAssign={(client_id) => mutate(() => api('/api/admin/assignments', 'POST', { user_id: u.id, client_id, role: u.role }))}
            onUnassign={(client_id) => mutate(() => api('/api/admin/assignments', 'DELETE', { user_id: u.id, client_id }))}
          />
        ))}
      </Card>

      <ClientsCard clients={clients} experts={experts} busy={busy}
        onCreate={(name) => mutate(() => api('/api/admin/clients', 'POST', { name }), `Created client "${name}".`)}
        onLead={(id, lead_ds) => mutate(() => api('/api/admin/clients', 'PATCH', { id, lead_ds }))}
      />
    </div>
  );
}

function UserRow({ u, clients, clientName, busy, onRole, onSignoff, onAssign, onUnassign }) {
  const [open, setOpen] = React.useState(false);
  const assigned = (u.user_clients || []).map((a) => a.client_id);
  const unassigned = clients.filter((c) => !assigned.includes(c.id));
  return (
    <div style={{ padding: '12px 18px', borderTop: '1px solid var(--line)' }}>
      <div className="between">
        <div className="row-h" style={{ gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 999, background: 'var(--panel3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--sky)', fontSize: 12 }} className="mono">
            {initials(u.full_name || u.email)}
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{u.full_name || u.email.split('@')[0]}</div>
            <div className="dim mono" style={{ fontSize: 11.5 }}>{u.email}</div>
          </div>
        </div>
        <div className="row-h" style={{ gap: 8 }}>
          <select className="input" style={{ height: 30, fontSize: 12, padding: '0 8px' }} value={u.role} disabled={busy}
            onChange={(e) => onRole(e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <button className={'tag ' + (u.can_sign_off ? 'mint' : 'default')} style={{ cursor: 'pointer', border: 'none' }}
            disabled={busy} title="Toggle sign-off authority (seniors only)" onClick={onSignoff}>
            {u.can_sign_off ? '✓ can sign off' : 'no sign-off'}
          </button>
          <button className="btn ghost small" onClick={() => setOpen((v) => !v)}>{open ? 'Close' : 'Manage'}</button>
        </div>
      </div>

      <div className="row-h" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap', paddingLeft: 44 }}>
        {assigned.length ? assigned.map((cid) => (
          <span key={cid} className="tag sky" style={{ fontSize: 10 }}>
            {clientName(cid)}
            {open ? <span style={{ cursor: 'pointer', marginLeft: 6 }} onClick={() => onUnassign(cid)}>×</span> : null}
          </span>
        )) : <span className="faint mono" style={{ fontSize: 10.5 }}>{u.role === 'in_house' ? 'all clients (in-house)' : 'no client assignments'}</span>}
      </div>

      {open ? (
        <div className="row-h" style={{ gap: 8, marginTop: 10, paddingLeft: 44 }}>
          <span className="faint mono" style={{ fontSize: 10.5 }}>ASSIGN TO</span>
          <select className="input" style={{ height: 30, fontSize: 12, padding: '0 8px', maxWidth: 220 }} disabled={busy || !unassigned.length}
            value="" onChange={(e) => e.target.value && onAssign(e.target.value)}>
            <option value="">{unassigned.length ? 'Select a client…' : 'assigned to all'}</option>
            {unassigned.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      ) : null}
    </div>
  );
}

function InviteForm({ clients, busy, onInvite }) {
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ email: '', full_name: '', role: 'client_signal', client_id: '', password: '' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    const payload = { email: f.email.trim(), full_name: f.full_name.trim() || undefined, role: f.role };
    if (f.client_id) payload.client_id = f.client_id;
    if (f.password) payload.password = f.password;
    try { await onInvite(payload); setF({ email: '', full_name: '', role: 'client_signal', client_id: '', password: '' }); setOpen(false); }
    catch { /* error shown by parent banner */ }
  };
  return (
    <Card>
      <div className="card-head">
        <h3>Invite a user</h3>
        <div className="actions"><button className="btn ghost small" onClick={() => setOpen((v) => !v)}>{open ? 'Cancel' : 'New user'}</button></div>
      </div>
      {open ? (
        <form className="card-pad" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }} onSubmit={submit}>
          <input className="input" placeholder="email@company.com" type="email" required value={f.email} onChange={set('email')} />
          <input className="input" placeholder="Full name (optional)" value={f.full_name} onChange={set('full_name')} />
          <select className="input" value={f.role} onChange={set('role')}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <select className="input" value={f.client_id} onChange={set('client_id')}>
            <option value="">Assign to client (optional)…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="input" placeholder="Temp password (optional)" value={f.password} onChange={set('password')} />
          <div className="row-h" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button type="submit" className="btn primary" disabled={busy || !f.email.trim()}>Send invite</button>
          </div>
          <div className="faint mono" style={{ fontSize: 10, gridColumn: '1 / -1' }}>
            Creating a login needs the server secret key. Roles, sign-off and client assignments below work without it.
          </div>
        </form>
      ) : null}
    </Card>
  );
}

function ClientsCard({ clients, experts, busy, onCreate, onLead }) {
  const [name, setName] = React.useState('');
  return (
    <Card>
      <div className="card-head">
        <h3>Clients <span className="faint mono" style={{ fontSize: 11 }}>· {clients.length}</span></h3>
        <form className="actions row-h" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onCreate(name.trim()); setName(''); } }}>
          <input className="input" style={{ height: 30, fontSize: 12 }} placeholder="New client name…" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn primary small" disabled={busy || !name.trim()}>Create</button>
        </form>
      </div>
      {clients.map((c) => (
        <div key={c.id} style={{ padding: '12px 18px', borderTop: '1px solid var(--line)' }} className="between">
          <div>
            <div style={{ fontWeight: 600 }}>{c.name}</div>
            <div className="dim mono" style={{ fontSize: 11 }}>{c.slug} · {c.status || c.state}</div>
          </div>
          <div className="row-h" style={{ gap: 8 }}>
            <span className="faint mono" style={{ fontSize: 10.5 }}>LEAD DS</span>
            <select className="input" style={{ height: 30, fontSize: 12, padding: '0 8px', maxWidth: 220 }} disabled={busy}
              value={c.lead_ds || ''} onChange={(e) => onLead(c.id, e.target.value)}>
              <option value="">— unassigned —</option>
              {experts.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
            </select>
          </div>
        </div>
      ))}
    </Card>
  );
}

function Card({ children }) {
  return <div className="card">{children}</div>;
}
function Banner({ kind, children }) {
  const bg = kind === 'red' ? 'rgba(229,72,77,0.12)' : kind === 'mint' ? 'rgba(55,211,155,0.12)' : 'var(--panel2)';
  const bd = kind === 'red' ? 'rgba(229,72,77,0.4)' : kind === 'mint' ? 'rgba(55,211,155,0.4)' : 'var(--line)';
  return <div style={{ background: bg, border: '1px solid ' + bd, borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{children}</div>;
}
