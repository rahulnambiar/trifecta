// Shared UI primitives. Globals at the bottom.

const Tag = ({ children, kind = 'default', solid = false, dot = false, style }) => {
  const cls = ['tag'];
  if (solid) cls.push('solid');
  if (kind && kind !== 'default') cls.push(kind);
  return (
    <span className={cls.join(' ')} style={style}>
      {dot ? <span className="dot" /> : null}
      {children}
    </span>
  );
};

const Btn = ({ children, kind = 'ghost', small = false, leftIcon, onClick, style, type }) => {
  const cls = ['btn', kind];
  if (small) cls.push('small');
  return (
    <button type={type || 'button'} className={cls.join(' ')} onClick={onClick} style={style}>
      {leftIcon ? <span style={{ display:'inline-flex' }}>{leftIcon}</span> : null}
      {children}
    </button>
  );
};

const Toggle = ({ on, onClick }) => (
  <div className={'tog' + (on ? ' on' : '')} onClick={onClick} role="switch" aria-checked={on}></div>
);

const Slider = ({ value, min = 0, max = 1, fmt }) => {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min))) * 100;
  return (
    <div className="slider">
      <div className="track">
        <div className="fill" style={{ width: `${pct}%` }} />
        <div className="handle" style={{ left: `${pct}%` }} />
      </div>
      <div className="val">{fmt ? fmt(value) : value}</div>
    </div>
  );
};

const Field = ({ label, value, mono = false, children, style }) => (
  <div className="field" style={style}>
    <label>{label}</label>
    <div className={'inset' + (mono ? ' mono' : '')}>
      {children != null ? children : value}
    </div>
  </div>
);

const Skel = ({ label, height = 220, style }) => (
  <div className="skel" style={{ height, ...(style || {}) }}>
    [ {label} ]
  </div>
);

const Progress = ({ value, max = 100 }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={'progress' + (pct >= 100 ? ' full' : '')}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
};

const Card = ({ children, style, pad = false, className = '' }) => (
  <div className={'card ' + className} style={style}>
    {pad ? <div className="card-pad">{children}</div> : children}
  </div>
);

const CardHead = ({ title, sub, actions, icon }) => (
  <div className="card-head">
    {icon ? <div style={{ color: 'var(--sky)', display:'inline-flex' }}>{icon}</div> : null}
    <div>
      <h3>{title}</h3>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
    {actions ? <div className="actions">{actions}</div> : null}
  </div>
);

const SectionHead = ({ title, sub, actions, style }) => (
  <div className="between" style={{ marginBottom: 12, ...(style || {}) }}>
    <div>
      <div className="display" style={{ fontWeight: 700, fontSize: 18 }}>{title}</div>
      {sub ? <div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>{sub}</div> : null}
    </div>
    {actions ? <div className="row-h" style={{ gap: 8 }}>{actions}</div> : null}
  </div>
);

// Lifecycle / stage strip - generic
const StageStrip = ({ steps, activeIndex = -1 }) => (
  <div className="strip">
    {steps.map((s, i) => (
      <div key={i} className={'step' + (i === activeIndex ? ' active' : '')}>
        <div className="n">STEP {String(i + 1).padStart(2, '0')}</div>
        <div className="t">{s.t}</div>
        {s.s ? <div className="s">{s.s}</div> : null}
      </div>
    ))}
  </div>
);

const Callout = ({ children, icon }) => (
  <div className="callout">
    <span className="ic" style={{ marginTop: 1 }}>{icon || <I.Info size={14} />}</span>
    <div>{children}</div>
  </div>
);

const ConnTag = ({ method }) => {
  // API, Feed, Upload, Manual entry, Warehouse
  const map = {
    'API':          { kind: 'sky',   label: 'API · auto' },
    'API · auto':   { kind: 'sky',   label: 'API · auto' },
    'Feed':         { kind: 'blue',  label: 'Feed · scheduled' },
    'Upload':       { kind: 'amber', label: 'Upload · manual' },
    'Manual entry': { kind: 'amber', label: 'Manual entry' },
    'Warehouse':    { kind: 'mint',  label: 'Warehouse · auto' },
  };
  const m = map[method] || { kind: 'default', label: method };
  return <Tag kind={m.kind}>{m.label}</Tag>;
};

const StatusTag = ({ status }) => {
  // Live, Action needed, Stale, Onboarding, Connected, Access pending
  const map = {
    'Live':            { kind: 'mint', solid: false, dot: true, label: 'LIVE' },
    'Healthy':         { kind: 'mint', label: 'HEALTHY' },
    'Action needed':   { kind: 'amber', label: 'ACTION NEEDED' },
    'Stale':           { kind: 'red',  label: 'STALE' },
    'Onboarding':      { kind: 'sky',  label: 'ONBOARDING' },
    'Connected':       { kind: 'mint', label: 'CONNECTED' },
    'Access pending':  { kind: 'amber', label: 'ACCESS PENDING' },
    'Draft':           { kind: 'sky',  label: 'DRAFT' },
    'Success':         { kind: 'mint', label: 'SUCCESS' },
    'Applied':         { kind: 'mint', label: 'APPLIED' },
    'Not yet run':     { kind: 'amber', label: 'NOT YET RUN' },
    'Archived':        { kind: 'default', label: 'ARCHIVED' },
  };
  const m = map[status] || { kind: 'default', label: status.toUpperCase() };
  return <Tag kind={m.kind} dot={m.dot}>{m.label}</Tag>;
};

const Logo = ({ size = 22 }) => (
  <span className="logomark" style={{ width: size, height: size, flexBasis: size }} />
);

Object.assign(window, {
  Tag, Btn, Toggle, Slider, Field, Skel, Progress, Card, CardHead,
  SectionHead, StageStrip, Callout, ConnTag, StatusTag, Logo
});
