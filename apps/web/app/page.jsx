'use client';
// Trifecta Platform operator console.
// Ported from the Claude Design handoff (trifecta-design/project/src/*.jsx),
// faithfully recreated as a Next.js client component. Shared-scope prototype
// modules are concatenated in load order; window.* exports and the standalone
// ReactDOM bootstrap are stripped (Next renders <App/> as the route).
import React from 'react';
import ResultsLive from './_components/ResultsLive';
import SignalChat from './_components/SignalChat';
import TeamAccess from './_components/TeamAccess';
import DataPipelineLive from './_components/DataPipelineLive';
import ModelVersions from './_components/ModelVersions';
import TrainingRunsLive from './_components/TrainingRunsLive';
import { getSupabaseBrowser, isSupabaseConfigured } from '../lib/supabase/client';

// ============================== icons.jsx ==============================
// Minimal inline Lucide-style icons. ~14-16px line icons.
const Icon = ({ d, size = 14, stroke = 1.6, fill = 'none', children, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {d ? <path d={d} /> : children}
  </svg>
);

const I = {
  // workspace / brand
  Grid: (p) => (<Icon {...p}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></Icon>),
  Layers: (p) => (<Icon {...p}><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></Icon>),
  // client modules
  Database: (p) => (<Icon {...p}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6"/></Icon>),
  Sliders: (p) => (<Icon {...p}><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><circle cx="4" cy="12" r="2"/><circle cx="12" cy="10" r="2"/><circle cx="20" cy="14" r="2"/></Icon>),
  Cpu: (p) => (<Icon {...p}><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></Icon>),
  Chart: (p) => (<Icon {...p}><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-6"/></Icon>),
  Signal: (p) => (<Icon {...p}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></Icon>),
  Settings2: (p) => (<Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></Icon>),
  Cog: (p) => (<Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></Icon>),
  // form / misc
  Chevron: (p) => (<Icon {...p}><polyline points="6 9 12 15 18 9"/></Icon>),
  Mail: (p) => (<Icon {...p}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></Icon>),
  Lock: (p) => (<Icon {...p}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></Icon>),
  Shield: (p) => (<Icon {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Icon>),
  ArrowRight: (p) => (<Icon {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></Icon>),
  Check: (p) => (<Icon {...p}><polyline points="20 6 9 17 4 12"/></Icon>),
  Plus: (p) => (<Icon {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Icon>),
  Play: (p) => (<Icon {...p}><polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/></Icon>),
  Info: (p) => (<Icon {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="8"/></Icon>),
  AlertTri: (p) => (<Icon {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17"/></Icon>),
  Upload: (p) => (<Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></Icon>),
  Plug: (p) => (<Icon {...p}><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z"/></Icon>),
  Cloud: (p) => (<Icon {...p}><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></Icon>),
  Edit: (p) => (<Icon {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><polygon points="18.5 2.5 21.5 5.5 12 15 9 15 9 12 18.5 2.5"/></Icon>),
  Tv: (p) => (<Icon {...p}><rect x="2" y="7" width="20" height="13" rx="2"/><polyline points="17 2 12 7 7 2"/></Icon>),
  Radio: (p) => (<Icon {...p}><circle cx="12" cy="12" r="2"/><path d="M4.93 19.07a10 10 0 0 1 0-14.14"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M7.76 16.24a6 6 0 0 1 0-8.48"/><path d="M16.24 7.76a6 6 0 0 1 0 8.48"/></Icon>),
  Print: (p) => (<Icon {...p}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></Icon>),
  Billboard: (p) => (<Icon {...p}><rect x="3" y="3" width="18" height="13" rx="1"/><line x1="8" y1="21" x2="8" y2="16"/><line x1="16" y1="21" x2="16" y2="16"/></Icon>),
  Film: (p) => (<Icon {...p}><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></Icon>),
  Search: (p) => (<Icon {...p}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Icon>),
  Users: (p) => (<Icon {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Icon>),
  Megaphone: (p) => (<Icon {...p}><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></Icon>),
  Globe: (p) => (<Icon {...p}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></Icon>),
  LogOut: (p) => (<Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Icon>),
  Tag: (p) => (<Icon {...p}><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7" y2="7"/></Icon>),
  Funnel: (p) => (<Icon {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></Icon>),
  Calendar: (p) => (<Icon {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Icon>),
  Trending: (p) => (<Icon {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></Icon>),
  Music: (p) => (<Icon {...p}><path d="M9 17V5l12-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></Icon>),
  Hash: (p) => (<Icon {...p}><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></Icon>),
  Dollar: (p) => (<Icon {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></Icon>),
  CloudSun: (p) => (<Icon {...p}><path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.95 11.95a3.95 3.95 0 1 0-7.9 0"/><path d="M16 16h2a4 4 0 0 1 0 8H6a5 5 0 1 1 .65-9.96"/></Icon>),
  Box: (p) => (<Icon {...p}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></Icon>),
  Compare: (p) => (<Icon {...p}><path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></Icon>),
  Sun: (p) => (<Icon {...p}><circle cx="12" cy="12" r="4"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></Icon>),
  Moon: (p) => (<Icon {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></Icon>),
  FileText: (p) => (<Icon {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="8" y1="9" x2="10" y2="9"/></Icon>),
  Send: (p) => (<Icon {...p}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></Icon>),
  Download: (p) => (<Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Icon>),
  Grip: (p) => (<Icon {...p}><circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="19" r="1" fill="currentColor"/><circle cx="15" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/></Icon>),
  Sparkles: (p) => (<Icon {...p}><path d="m12 3-1.9 5.8-5.8 1.9 5.8 1.9L12 18.4l1.9-5.8 5.8-1.9-5.8-1.9z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></Icon>),
  X: (p) => (<Icon {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Icon>),
  Eye: (p) => (<Icon {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></Icon>),
  ChevronUp: (p) => (<Icon {...p}><polyline points="18 15 12 9 6 15"/></Icon>),
  Clock: (p) => (<Icon {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Icon>),
};


// ============================== components.jsx ==============================
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

const Btn = ({ children, kind = 'ghost', small = false, leftIcon, onClick, style, type, disabled }) => {
  const cls = ['btn', kind];
  if (small) cls.push('small');
  return (
    <button type={type || 'button'} className={cls.join(' ')} onClick={onClick} style={style} disabled={disabled}>
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

// Editable prior — a draggable range input bound to value/onChange (used in Model Studio).
const PriorEdit = ({ label, help, value, min, max, step, fmt, onChange }) => (
  <div>
    <div className="mono faint" style={{ fontSize: 10, letterSpacing: '0.14em' }}>{label}</div>
    <div className="dim" style={{ fontSize: 11.5, marginBottom: 8 }}>{help}</div>
    <div className="row-h" style={{ gap: 10 }}>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} style={{ flex: 1 }} />
      <span className="mono" style={{ fontSize: 12, minWidth: 78, textAlign: 'right' }}>{fmt ? fmt(value) : value}</span>
    </div>
  </div>
);

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


// ============================== data.jsx ==============================
// Fictional sample data referenced from the PRD.
const TRIFECTA_DATA = {
  operator: { name: 'Rajeev Bala', email: 'rajeev@trifecta.sg' },

  clients: [
    { id: 'aeon',     name: 'Aeon Skincare',   readiness: 78,  version: 'v3', state: 'live',       run: 'Next run 01 Jun', actions: 3, status: 'Action needed',
      steps: { data: 'attention', config: 'done',    train: 'done',    results: 'done',    signal: 'done'    } },
    { id: 'northwind',name: 'Northwind Coffee',readiness: 100, version: 'v5', state: 'live',       run: 'Trained 12 May',  actions: 0, status: 'Healthy',
      steps: { data: 'done',      config: 'done',    train: 'done',    results: 'done',    signal: 'done'    } },
    { id: 'lumio',    name: 'Lumio Home',      readiness: 64,  version: 'v2', state: 'draft',      run: 'Onboarding',      actions: 6, status: 'Onboarding',
      steps: { data: 'active',    config: 'pending', train: 'pending', results: 'pending', signal: 'pending' } },
    { id: 'vega',     name: 'Vega Mobility',   readiness: 92,  version: 'v4', state: 'live',       run: 'Next run 28 May', actions: 1, status: 'Healthy',
      steps: { data: 'done',      config: 'done',    train: 'done',    results: 'done',    signal: 'attention' } },
  ],

  activeClientId: 'aeon',

  lifecycle: [
    { t: 'Connect data',          s: 'sources → harmonised' },
    { t: 'Configure model',       s: 'channels, priors, calibration' },
    { t: 'Train & calibrate',     s: 'Meridian on Vertex AI GPU' },
    { t: 'Analyse results',       s: 'contribution, ROI, optimiser' },
    { t: 'Signal (client)',       s: 'conversational decision layer' },
  ],

  // Data Pipeline ------------------------------------------------------------

  pipelineStages: [
    { t: 'Intake',      s: '~20 sources' },
    { t: 'Validate',    s: '2 warnings' },
    { t: 'Harmonise',   s: '~70 → 23 vars' },
    { t: 'Model-ready', s: '78%' },
  ],

  pipelineCategories: [
    {
      title: 'Paid media — Digital',
      note: 'Mixed methods, not all-API. A brand with no ad server uploads its programmatic and creator numbers in a spreadsheet exactly as it does its TV.',
      sources: [
        { name: 'Google Ads',                  ic: 'search',     cadence: 'daily',   coverage: 'Jan 2024 – Apr 2026', method: 'API',          status: 'Live' },
        { name: 'Meta Ads',                    ic: 'megaphone',  cadence: 'daily',   coverage: 'Jan 2024 – Apr 2026', method: 'API',          status: 'Live' },
        { name: 'TikTok Ads',                  ic: 'music',      cadence: 'daily',   coverage: 'Jan 2024 – Apr 2026', method: 'API',          status: 'Live' },
        { name: 'DV360 / ad server',           ic: 'plug',       cadence: 'daily',   coverage: 'client has no ad server — N/A', method: 'API', status: 'Action needed', warn: 'Client has no ad server — programmatic & display arrive via Upload instead.' },
        { name: 'Programmatic (direct buy)',   ic: 'globe',      cadence: 'monthly', coverage: 'Jan 2024 – Mar 2026', method: 'Upload',       status: 'Live' },
        { name: 'Influencer / creator',        ic: 'users',      cadence: 'monthly', coverage: 'Jan 2024 – Mar 2026', method: 'Upload',       status: 'Action needed', warn: 'April spend file not yet received from agency.' },
        { name: 'Podcasts & audio',            ic: 'music',      cadence: 'monthly', coverage: 'Jan 2024 – Mar 2026', method: 'Upload',       status: 'Live' },
        { name: 'Affiliate networks',          ic: 'tag',        cadence: 'monthly', coverage: 'Jan 2024 – Apr 2026', method: 'Upload',       status: 'Live' },
        { name: 'Publisher direct buys',       ic: 'globe',      cadence: 'monthly', coverage: 'Jan 2024 – Mar 2026', method: 'Upload',       status: 'Live' },
      ],
    },
    {
      title: 'Paid media — Traditional',
      note: 'No APIs exist — each arrives as an agency file, no two formats alike.',
      sources: [
        { name: 'TV',          ic: 'tv',         cadence: 'GRPs + spend · weekly', coverage: 'Jan 2024 – Apr 2026', method: 'Feed',         status: 'Action needed', warn: 'Agency changed file layout — 3 columns need remapping.' },
        { name: 'Radio',       ic: 'radio',      cadence: 'weekly',  coverage: 'Jan 2024 – Apr 2026', method: 'Upload',       status: 'Live' },
        { name: 'Print',       ic: 'print',      cadence: 'monthly', coverage: 'Jan 2024 – Mar 2026', method: 'Upload',       status: 'Stale', warn: 'Last file 41 days old.' },
        { name: 'Out-of-Home', ic: 'billboard',  cadence: 'monthly', coverage: 'Jan 2024 – Apr 2026', method: 'Upload',       status: 'Live' },
        { name: 'Cinema',      ic: 'film',       cadence: 'monthly', coverage: 'Jan 2024 – Apr 2026', method: 'Manual entry', status: 'Live' },
      ],
    },
    {
      title: 'Business outcomes',
      note: null,
      sources: [
        { name: 'Sales / Revenue (DTC + retail POS)', ic: 'dollar',   cadence: 'daily',  coverage: 'Jan 2024 – Apr 2026', method: 'Warehouse', status: 'Live' },
        { name: 'Web conversions (GA4)',              ic: 'trending', cadence: 'daily',  coverage: 'Jan 2024 – Apr 2026', method: 'Warehouse', status: 'Live' },
      ],
    },
    {
      title: 'Control variables & external signals',
      note: 'Without these, media takes credit for things it didn’t cause.',
      sources: [
        { name: 'Price index',           ic: 'hash',      cadence: 'weekly',  coverage: 'Jan 2024 – Apr 2026', method: 'Warehouse', status: 'Live' },
        { name: 'Promotions calendar',   ic: 'calendar',  cadence: 'weekly',  coverage: 'Jan 2024 – Apr 2026', method: 'Upload',    status: 'Live' },
        { name: 'Distribution / availability', ic: 'box', cadence: 'weekly',  coverage: 'Jan 2024 – Feb 2026', method: 'Feed',      status: 'Action needed', warn: 'Distribution feed missing Mar & Apr — retailer changed export.' },
        { name: 'Competitor media (estimate)', ic: 'megaphone', cadence: 'monthly', coverage: 'Jan 2024 – Mar 2026', method: 'API', status: 'Live' },
        { name: 'Weather',               ic: 'cloudsun',  cadence: 'weekly',  coverage: 'Jan 2024 – Apr 2026', method: 'API',       status: 'Live' },
        { name: 'Google query volume',   ic: 'search',    cadence: 'weekly',  coverage: 'Jan 2024 – Apr 2026', method: 'API',       status: 'Live' },
        { name: 'Consumer confidence',   ic: 'trending',  cadence: 'monthly', coverage: 'Jan 2024 – Apr 2026', method: 'Upload',    status: 'Live' },
      ],
    },
  ],

  actionQueue: [
    { client: 'Aeon Skincare', area: 'TV',                      msg: 'Agency changed file layout — 3 columns need remapping.', tag: 'Action needed' },
    { client: 'Aeon Skincare', area: 'Print',                   msg: 'Last file 41 days old — request April upload.',          tag: 'Stale' },
    { client: 'Aeon Skincare', area: 'Influencer / creator',    msg: 'April spend file not yet received.',                     tag: 'Action needed' },
    { client: 'Aeon Skincare', area: 'Distribution',            msg: 'Distribution feed missing Mar & Apr.',                   tag: 'Action needed' },
  ],

  // Model Studio ------------------------------------------------------------

  channels: [
    { id: 'tv',     name: 'TV',           on: true,  roi: 1.8, strength: 'Strong', strengthN: 0.8, adstock: 0.72, priorSource: 'Geo-test + category', medium: 'Traditional' },
    { id: 'radio',  name: 'Radio',        on: true,  roi: 1.4, strength: 'Medium', strengthN: 0.55,adstock: 0.55, priorSource: 'Category prior',      medium: 'Traditional' },
    { id: 'print',  name: 'Print',        on: true,  roi: 1.1, strength: 'Weak',   strengthN: 0.3, adstock: 0.40, priorSource: 'Default',             medium: 'Traditional' },
    { id: 'ooh',    name: 'Out-of-Home',  on: true,  roi: 1.3, strength: 'Medium', strengthN: 0.55,adstock: 0.50, priorSource: 'Category prior',      medium: 'Traditional' },
    { id: 'meta',   name: 'Meta',         on: true,  roi: 2.4, strength: 'Strong', strengthN: 0.8, adstock: 0.30, priorSource: 'Mar 2026 geo-test',   medium: 'Digital' },
    { id: 'yt',     name: 'YouTube',      on: true,  roi: 3.0, strength: 'Medium', strengthN: 0.55,adstock: 0.35, priorSource: 'Prior model v2',      medium: 'Digital' },
    { id: 'tiktok', name: 'TikTok',       on: true,  roi: 2.6, strength: 'Weak',   strengthN: 0.3, adstock: 0.25, priorSource: 'Default',             medium: 'Digital' },
    { id: 'search', name: 'Paid Search',  on: true,  roi: 2.0, strength: 'Medium', strengthN: 0.55,adstock: 0.15, priorSource: 'Calibrated',          medium: 'Digital' },
    { id: 'prog',   name: 'Programmatic', on: false, roi: 1.5, strength: 'Weak',   strengthN: 0.3, adstock: 0.30, priorSource: 'Default',             medium: 'Digital' },
  ],

  controls: [
    { id: 'price',  name: 'Price index',                  on: true,  desc: 'Weekly mean price for the brand’s SKUs, indexed to Jan 2024.' },
    { id: 'promo',  name: 'Promotions calendar',          on: true,  desc: 'Operator-maintained calendar of price-off and bundling events.' },
    { id: 'dist',   name: 'Distribution / availability',  on: true,  desc: '% of retail stores stocking the lead SKU each week.' },
    { id: 'comp',   name: 'Competitor media',             on: true,  desc: 'Estimated category spend (TV + digital) from a third-party panel.' },
    { id: 'wx',     name: 'Weather',                      on: true,  desc: 'Population-weighted temperature & rainfall index.' },
    { id: 'gquery', name: 'Google query volume',          on: true,  desc: 'Branded + category search trends, weekly.' },
    { id: 'conf',   name: 'Consumer confidence',          on: false, desc: 'National consumer confidence index, monthly → interpolated.' },
    { id: 'season', name: 'Seasonality (Fourier)',        on: true,  desc: 'Fourier terms capturing yearly seasonality the controls don’t.' },
  ],

  calibrations: [
    { name: 'Meta geo-holdout',     period: 'Mar 2026',  appliesTo: 'Meta ROI prior',   status: 'Applied' },
    { name: 'TV regional lift',     period: 'Q4 2025',   appliesTo: 'TV ROI prior',     status: 'Applied' },
    { name: 'TikTok holdout',       period: 'Proposed',  appliesTo: 'TikTok ROI prior', status: 'Not yet run' },
  ],

  modelSettings: [
    { label: 'Outcome / KPI',            value: 'Revenue, SGD' },
    { label: 'Geography level',          value: 'National + 5 regions' },
    { label: 'Time granularity',         value: 'Weekly' },
    { label: 'Training window',          value: 'Jan 2024 – Apr 2026 · 122 wks' },
    { label: 'Holdout for validation',   value: 'Last 8 weeks' },
    { label: 'Media effect prior',       value: 'LogNormal ROI' },
    { label: 'Reach & frequency',        value: 'TV, YouTube' },
    { label: 'Sampler',                  value: 'Meridian — NUTS, 4 chains' },
  ],

  versions: [
    { id: 'v3', tag: 'Live',     date: 'trained 12 May 2026', note: 'R-hat 1.01 · holdout MAPE 9%' },
    { id: 'v2', tag: 'Archived', date: '03 Apr 2026',          note: 'Pre-Meta calibration' },
    { id: 'v1', tag: 'Archived', date: '28 Feb 2026',          note: 'Initial build' },
  ],

  runs: [
    { id: '#28', v: 'v3', started: '12 May · 09:14', dur: '2h 41m', status: 'Success', rhat: '1.01', mape: '9%' },
    { id: '#27', v: 'v3', started: '01 May · 09:02', dur: '2h 38m', status: 'Success', rhat: '1.01', mape: '10%' },
    { id: '#26', v: 'v2', started: '03 Apr · 09:10', dur: '2h 51m', status: 'Success', rhat: '1.02', mape: '12%' },
    { id: '#25', v: 'v2', started: '01 Mar · 09:00', dur: '2h 44m', status: 'Success', rhat: '1.02', mape: '13%' },
  ],

  signalTools: [
    { name: 'Channel contribution',        on: true,  desc: 'Decompose revenue by channel for a chosen window.' },
    { name: 'Marginal ROI',                on: true,  desc: 'Incremental return on the next dollar in each channel.' },
    { name: 'Budget scenario',             on: true,  desc: '“What happens if I move $X from A → B” — Q&A.' },
    { name: 'Budget optimiser',            on: true,  desc: 'Solve for the allocation that maximises revenue under a constraint.' },
    { name: 'Measurement reconciliation',  on: true,  desc: 'Compare MMM lift vs. platform-reported attribution.' },
    { name: 'Model health',                on: true,  desc: 'Surface diagnostics, freshness, and confidence.' },
    { name: 'Experiment proposals',        on: false, desc: 'Suggest geo-holdout tests where the model is least sure.' },
    { name: 'Decision log',                on: true,  desc: 'Record decisions the client made off Signal.' },
  ],

  clientAccess: [
    { email: 'maya@aeonskincare.com', role: 'Head of Growth',     access: 'Editor' },
    { email: 'sam@aeonskincare.com',  role: 'Marketing Analyst',  access: 'Viewer' },
  ],

  modelLibrary: [
    { id: 'dtc',    name: 'DTC E-commerce',         desc: 'digital-led',          channels: 8,  clients: 6, tags: ['Meta','TikTok','Search','Programmatic'] },
    { id: 'fmcg',   name: 'FMCG / Retail',          desc: 'offline-heavy',         channels: 11, clients: 3, tags: ['TV','OOH','Print','Promo','Distribution'] },
    { id: 'saas',   name: 'Subscription / SaaS',    desc: 'lead-gen funnel',       channels: 7,  clients: 2, tags: ['Search','LinkedIn','Display','Content'] },
    { id: 'travel', name: 'Travel & Hospitality',   desc: 'strong seasonality',    channels: 9,  clients: 1, tags: ['Search','Meta','TV','Affiliate'] },
  ],

  team: [
    { name: 'Rajeev Bala', email: 'rajeev@trifecta.sg', role: 'Admin · Owner' },
    { name: 'Priya Menon', email: 'priya@trifecta.sg',  role: 'Admin' },
  ],

  infra: [
    { name: 'BigQuery',               desc: 'warehouse',                  status: 'Connected', icon: 'database' },
    { name: 'Cloud Storage (GCS)',    desc: 'posterior artifacts',        status: 'Connected', icon: 'cloud' },
    { name: 'Meridian compute',      desc: 'Vertex AI · GPU',            status: 'Connected', icon: 'cpu' },
    { name: 'Ads Data Hub',           desc: 'privacy-safe attribution',   status: 'Access pending', icon: 'shield' },
  ],
};


// ============================== screens-workspace.jsx ==============================
// Dashboard (Portfolio) and Model Library

const STEP_DEFS = [
  { id: 'data',    label: 'Data' },
  { id: 'config',  label: 'Config' },
  { id: 'train',   label: 'Train' },
  { id: 'results', label: 'Results' },
  { id: 'signal',  label: 'Signal' },
];

const LifecycleDots = ({ steps }) => {
  return (
    <div className="lc-row">
      {STEP_DEFS.map((s, i) => {
        const status = steps[s.id] || 'pending';
        const next = STEP_DEFS[i + 1];
        const connDone = status === 'done';
        let glyph = i + 1;
        if (status === 'done') glyph = <I.Check size={11} />;
        else if (status === 'attention') glyph = '!';
        return (
          <React.Fragment key={s.id}>
            <div className="lc-step">
              <div className={'lc-dot ' + status}>{glyph}</div>
              <div className="lc-label">{s.label}</div>
            </div>
            {next ? <div className={'lc-conn' + (connDone ? ' done' : '')} /> : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const Dashboard = ({ go, enterClient, openAddClient, clients }) => {
  const d = TRIFECTA_DATA;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Stat tiles */}
      <div className="grid g4">
        <div className="tile">
          <div className="lbl">Active clients</div>
          <div className="v mono">{clients.length}</div>
          <div className="dim" style={{ fontSize: 12 }}>{clients.filter(c => c.state === 'live').length} live · {clients.filter(c => c.state === 'draft').length} onboarding</div>
        </div>
        <div className="tile">
          <div className="lbl">Models live</div>
          <div className="v mono">{clients.filter(c => c.state === 'live').length}</div>
          <div className="dim" style={{ fontSize: 12 }}>Aeon v3 · Northwind v5 · Vega v4</div>
        </div>
        <div className="tile">
          <div className="lbl">Open actions</div>
          <div className="v mono" style={{ color: 'var(--amber)' }}>{clients.reduce((s, c) => s + c.actions, 0)}</div>
          <div className="dim" style={{ fontSize: 12 }}>across {clients.filter(c => c.actions).length} clients</div>
        </div>
        <div className="tile">
          <div className="lbl">Next training run</div>
          <div className="v mono">28<span className="unit">May</span></div>
          <div className="dim" style={{ fontSize: 12 }}>Vega Mobility · v4 refresh</div>
        </div>
      </div>

      {/* Portfolio */}
      <div>
        <SectionHead
          title="Client portfolio"
          sub="Click a card to enter that client."
          actions={<Btn kind="primary" leftIcon={<I.Plus size={13} />} onClick={openAddClient}>Add client</Btn>}
        />
        <div className="grid g2">
          {clients.map(c => (
            <div
              key={c.id}
              className="card"
              style={{ padding: 18, cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'var(--line2)'}
              onMouseOut={e => e.currentTarget.style.borderColor = 'var(--line)'}
              onClick={() => enterClient(c.id)}
            >
              <div className="between">
                <div className="row-h" style={{ gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--panel3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center' }}>
                    <span className="mono" style={{ fontSize: 13, color: 'var(--sky)' }}>{c.name[0]}</span>
                  </div>
                  <div>
                    <div className="display" style={{ fontWeight: 700, fontSize: 16 }}>{c.name}</div>
                    <div className="dim mono" style={{ fontSize: 11 }}>{c.version} · {c.state} · {c.run}</div>
                  </div>
                </div>
                <StatusTag status={c.status} />
              </div>

              {/* Lifecycle dots */}
              <div style={{ marginTop: 16, padding: '10px 4px 4px', borderTop: '1px dashed var(--line)' }}>
                <LifecycleDots steps={c.steps} />
              </div>

              {/* Readiness */}
              <div style={{ marginTop: 14 }}>
                <div className="between" style={{ marginBottom: 6 }}>
                  <div className="mono faint" style={{ fontSize: 10.5, letterSpacing: '0.14em' }}>MODEL READINESS</div>
                  <div className="mono" style={{ fontSize: 12 }}>{c.readiness}%</div>
                </div>
                <Progress value={c.readiness} />
              </div>

              <div className="between" style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12.5, color: c.actions ? 'var(--amber)' : 'var(--faint)' }}>
                  {c.actions ? (
                    <span className="row-h" style={{ gap: 6 }}>
                      <I.AlertTri size={13} /> {c.actions} action{c.actions > 1 ? 's' : ''} pending
                    </span>
                  ) : (
                    <span className="row-h" style={{ gap: 6 }}>
                      <I.Check size={13} /> No actions pending
                    </span>
                  )}
                </div>
                <span className="row-h faint" style={{ gap: 6, fontSize: 12 }}>
                  Enter client <I.ArrowRight size={12} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------

const ModelLibrary = ({ go }) => {
  const d = TRIFECTA_DATA;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Callout icon={<I.Layers size={14} />}>
        <strong>Reusable model archetypes.</strong> Channel sets, priors and adstock defaults.
        Clone one to start a new client model, then tune it per brand in Model Studio.
      </Callout>

      <div className="grid g2">
        {d.modelLibrary.map(t => (
          <Card key={t.id}>
            <div className="card-pad">
              <div className="between" style={{ marginBottom: 12 }}>
                <div>
                  <div className="display" style={{ fontWeight: 700, fontSize: 17 }}>{t.name}</div>
                  <div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>{t.desc}</div>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--panel3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--sky)' }}>
                  <I.Layers size={16} />
                </div>
              </div>

              <div className="grid g2" style={{ gap: 10, marginBottom: 14 }}>
                <div className="tile" style={{ padding: '10px 12px' }}>
                  <div className="lbl">Channels</div>
                  <div className="mono" style={{ fontSize: 18, fontFamily: 'var(--f-display)', fontWeight: 700 }}>{t.channels}</div>
                </div>
                <div className="tile" style={{ padding: '10px 12px' }}>
                  <div className="lbl">Used by</div>
                  <div className="mono" style={{ fontSize: 18, fontFamily: 'var(--f-display)', fontWeight: 700 }}>{t.clients} <span style={{ fontSize: 12, color: 'var(--dim)' }}>client{t.clients>1?'s':''}</span></div>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {t.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}
              </div>

              <Btn kind="primary" leftIcon={<I.ArrowRight size={13} />} onClick={() => go('model-studio')}>
                Use template
              </Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};


// ============================== screens-data-pipeline.jsx ==============================
// Data Pipeline screen

const ICON_BY_KEY = {
  search: <I.Search size={14} />,
  megaphone: <I.Megaphone size={14} />,
  music: <I.Music size={14} />,
  plug: <I.Plug size={14} />,
  globe: <I.Globe size={14} />,
  users: <I.Users size={14} />,
  tag: <I.Tag size={14} />,
  tv: <I.Tv size={14} />,
  radio: <I.Radio size={14} />,
  print: <I.Print size={14} />,
  billboard: <I.Billboard size={14} />,
  film: <I.Film size={14} />,
  dollar: <I.Dollar size={14} />,
  trending: <I.Trending size={14} />,
  hash: <I.Hash size={14} />,
  calendar: <I.Calendar size={14} />,
  box: <I.Box size={14} />,
  cloudsun: <I.CloudSun size={14} />,
};

const SourceRow = ({ s }) => (
  <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)' }}>
    <div className="row-h" style={{ gap: 14 }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--panel3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--sky)', flex: '0 0 28px' }}>
        {ICON_BY_KEY[s.ic] || <I.Plug size={14} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row-h" style={{ gap: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
        </div>
        <div className="dim mono" style={{ fontSize: 11, marginTop: 2 }}>{s.cadence} · {s.coverage}</div>
      </div>
      <ConnTag method={s.method} />
      <StatusTag status={s.status} />
      {s.method === 'Upload' ? (
        <Btn small kind="ghost" leftIcon={<I.Upload size={12} />}>Upload &amp; map</Btn>
      ) : (
        <Btn small kind="ghost">Configure</Btn>
      )}
    </div>
    {s.warn ? (
      <div className="row-h" style={{ gap: 8, marginTop: 8, padding: '8px 10px', background: 'rgba(230,176,82,0.06)', border: '1px solid rgba(230,176,82,0.25)', borderRadius: 6 }}>
        <span style={{ color: 'var(--amber)' }}><I.AlertTri size={13} /></span>
        <div style={{ fontSize: 12, color: 'var(--text)' }}>{s.warn}</div>
      </div>
    ) : null}
  </div>
);

const CategoryCard = ({ cat }) => (
  <Card>
    <div className="card-head">
      <div>
        <h3>{cat.title}</h3>
        {cat.note ? <div className="sub" style={{ marginTop: 2 }}>{cat.note}</div> : null}
      </div>
      <div className="actions">
        <span className="mono faint" style={{ fontSize: 11 }}>{cat.sources.length} sources</span>
      </div>
    </div>
    {cat.sources.map((s, i) => <SourceRow key={i} s={s} />)}
  </Card>
);

const DataPipeline = ({ client }) => {
  const d = TRIFECTA_DATA;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
        {/* Readiness banner */}
        <Card>
          <div style={{ padding: 20 }}>
            <div className="between">
              <div>
                <div className="mono faint" style={{ fontSize: 10.5, letterSpacing: '0.16em', marginBottom: 4 }}>MODEL READINESS — {client.name.toUpperCase()}</div>
                <div className="display" style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {client.readiness}<span style={{ fontSize: 22, color: 'var(--dim)' }}>%</span>
                </div>
                <div className="dim mono" style={{ fontSize: 11.5, marginTop: 8 }}>
                  ~20 sources · ~70 raw line items → 23 model variables · weekly, Jan 2024 – Apr 2026
                </div>
              </div>
              <Btn kind="primary" leftIcon={<I.Plus size={13} />}>Connect source</Btn>
            </div>
            <div style={{ marginTop: 18 }}>
              <Progress value={client.readiness} />
            </div>
          </div>
        </Card>

        {/* Pipeline stages */}
        <div>
          <SectionHead
            title="Pipeline stages"
            sub="From inconsistent agency files to one harmonised weekly time series."
          />
          <StageStrip steps={d.pipelineStages} activeIndex={2} />
        </div>

        {/* Connection methods callout */}
        <Callout icon={<I.Info size={14} />}>
          <strong>Connection method is independent of channel type.</strong> Any source — digital
          or offline — can use any method. A brand with no ad server uploads its display and
          programmatic numbers in a spreadsheet exactly as it does its TV. The platform treats
          an uploaded digital source as a first-class citizen, with the same column-mapping and
          QA as offline media.
          <div className="row-h" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <Tag kind="sky">API · auto</Tag>
            <Tag kind="blue">Feed · scheduled</Tag>
            <Tag kind="amber">Upload · manual</Tag>
            <Tag kind="amber">Manual entry</Tag>
            <Tag kind="mint">Warehouse · auto</Tag>
          </div>
        </Callout>

        {/* Source categories */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {d.pipelineCategories.map(c => <CategoryCard key={c.title} cat={c} />)}
        </div>

        {/* Upload & map explainer */}
        <Card>
          <CardHead
            icon={<I.Upload size={14} />}
            title="Upload &amp; map"
            sub="The platform’s most-used ingestion path — used by digital and offline sources alike."
          />
          <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[
              { n: '1', t: 'Drop file', s: 'Excel / CSV from the agency, however they sent it this month.' },
              { n: '2', t: 'Map columns', s: 'Match their headers to canonical: channel, week, spend, impressions, geo.' },
              { n: '3', t: 'Save as recipe', s: 'Future files use the saved mapping. Layout drift flags as “needs remapping”.' },
            ].map(s => (
              <div key={s.n} style={{ padding: 14, border: '1px dashed var(--line2)', borderRadius: 8, background: 'var(--panel3)' }}>
                <div className="mono faint" style={{ fontSize: 10, letterSpacing: '0.14em' }}>STEP {s.n}</div>
                <div style={{ fontWeight: 600, marginTop: 4 }}>{s.t}</div>
                <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>{s.s}</div>
              </div>
            ))}
          </div>
        </Card>

        <Callout icon={<I.AlertTri size={14} />}>
          The model is the easy 20%. The hard part is everything <strong>without an API</strong> —
          offline media <em>and</em> a large share of digital spend — arriving as inconsistent
          spreadsheets. The platform templates the upload-and-harmonise work once, so two people
          can repeat it across every client.
        </Callout>
      </div>

      {/* Right rail */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'sticky', top: 78, alignSelf: 'start', maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
        <Card>
          <CardHead title="Harmonisation engine" sub="Sources → variables" icon={<I.Funnel size={14} />} />
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { l: '~20 sources',          w: '100%' },
              { l: '~70 raw line items',   w: '78%' },
              { l: '23 model variables',   w: '50%' },
              { l: '122 weekly rows',      w: '36%' },
            ].map((r, i) => (
              <div key={i}>
                <div className="between" style={{ marginBottom: 4 }}>
                  <div className="mono" style={{ fontSize: 11.5 }}>{r.l}</div>
                </div>
                <div style={{ height: 22, background: 'var(--panel3)', border: '1px solid var(--line)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, width: r.w, background: 'linear-gradient(90deg, rgba(79,110,242,0.4), rgba(55,211,155,0.4))' }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="Data coverage" sub="Last 6 months · weekly" icon={<I.Calendar size={14} />} />
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { n: 'Google Ads (API)',       segs: [['ok','100']] },
              { n: 'Meta Ads (API)',         segs: [['ok','100']] },
              { n: 'TV (Feed)',              segs: [['ok','80'],['late','20']] },
              { n: 'Influencer (Upload)',    segs: [['ok','65'],['gap','15'],['late','20']] },
              { n: 'Print (Upload)',         segs: [['ok','55'],['gap','45']] },
              { n: 'Programmatic (Upload)',  segs: [['ok','75'],['late','25']] },
            ].map((r, i) => (
              <div key={i}>
                <div className="between" style={{ marginBottom: 4 }}>
                  <div className="mono" style={{ fontSize: 11 }}>{r.n}</div>
                </div>
                <div className="cov">
                  {r.segs.map((s, j) => <span key={j} className={s[0]} style={{ width: s[1] + '%' }} />)}
                </div>
              </div>
            ))}
            <div className="row-h" style={{ gap: 12, marginTop: 4, fontSize: 11 }}>
              <span className="row-h" style={{ gap: 4 }}><span style={{ width: 8, height: 8, background: 'var(--mint)', borderRadius: 2 }} /> on time</span>
              <span className="row-h" style={{ gap: 4 }}><span style={{ width: 8, height: 8, background: 'var(--amber)', borderRadius: 2 }} /> late</span>
              <span className="row-h" style={{ gap: 4 }}><span style={{ width: 8, height: 8, background: 'var(--red)', borderRadius: 2 }} /> gap</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="Action queue" sub={`${d.actionQueue.length} open items`} icon={<I.AlertTri size={14} />} />
          <div>
            {d.actionQueue.map((a, i) => (
              <div key={i} style={{ padding: '10px 14px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <div className="row-h" style={{ gap: 8, marginBottom: 4 }}>
                  <StatusTag status={a.tag} />
                  <div className="mono faint" style={{ fontSize: 11 }}>{a.area}</div>
                </div>
                <div style={{ fontSize: 12 }}>{a.msg}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};


// ============================== screens-model-studio.jsx ==============================
// Model Studio — the core screen, 5 internal tabs

const STRENGTH_BY_LABEL = { 'Strong': 0.85, 'Medium': 0.55, 'Weak': 0.3 };

const StudioVersionBar = () => (
  <div className="card" style={{ marginBottom: 18, padding: '14px 18px' }}>
    <div className="between">
      <div className="row-h" style={{ gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--panel3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--sky)' }}>
          <I.Sliders size={18} />
        </div>
        <div>
          <div className="row-h" style={{ gap: 10 }}>
            <div className="display" style={{ fontWeight: 700, fontSize: 18 }}>Aeon MMM — v3</div>
            <StatusTag status="Live" />
          </div>
          <div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>Bayesian MMM · Google Meridian · trained 12 May 2026</div>
        </div>
      </div>
      <div className="row-h" style={{ gap: 8 }}>
        <Btn kind="ghost" leftIcon={<I.Plus size={13} />}>New version</Btn>
        <Btn kind="ghost" leftIcon={<I.Layers size={13} />}>Save as template</Btn>
        <Btn kind="primary" leftIcon={<I.Play size={11} />}>Start training run</Btn>
      </div>
    </div>
  </div>
);

const ChannelsAndPriors = ({ channels, setChannels, onSave, saving, savedAt }) => {
  const chans = channels;
  const [selected, setSelected] = React.useState(chans[0]?.id || 'meta');

  const sel = chans.find(c => c.id === selected) || chans[0];

  const toggle = (id) => setChannels(prev => prev.map(c => c.id === id ? { ...c, on: !c.on } : c));
  const editSel = (key, val) => setChannels(prev => prev.map(c => c.id === sel.id ? { ...c, [key]: val } : c));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Callout icon={<I.Info size={14} />}>
        <strong>Per-brand model weights.</strong> Priors are the model’s starting beliefs about
        each channel; strength controls how much the brand’s own data can move them. Every client
        runs a different configuration — tuned from category benchmarks, prior model versions,
        and that brand’s own incrementality tests.
      </Callout>

      <Card>
        <CardHead
          title="Channels &amp; priors"
          sub={`${chans.length} channels · ${chans.filter(c => c.on).length} included · ${chans.filter(c => !c.on).length} excluded`}
          icon={<I.Sliders size={14} />}
          actions={
            <>
              {savedAt ? <span className="faint mono" style={{ fontSize: 10 }}>saved {savedAt}</span> : null}
              <Btn small kind="primary" leftIcon={<I.Check size={12} />} onClick={onSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save configuration'}
              </Btn>
            </>
          }
        />
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Channel</th>
              <th style={{ width: '8%' }}>Include</th>
              <th style={{ width: '14%' }}>ROI prior (μ)</th>
              <th style={{ width: '14%' }}>Strength</th>
              <th style={{ width: '14%' }}>Adstock</th>
              <th>Prior source</th>
            </tr>
          </thead>
          <tbody>
            {chans.map(c => (
              <tr key={c.id}
                  className={(c.on ? '' : 'dim ') + 'selectable ' + (c.id === selected ? 'selected' : '')}
                  onClick={() => setSelected(c.id)}>
                <td>
                  <div className="row-h" style={{ gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: c.medium === 'Digital' ? 'var(--sky)' : 'var(--amber)' }} />
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <Tag>{c.medium}</Tag>
                  </div>
                </td>
                <td onClick={e => { e.stopPropagation(); toggle(c.id); }}>
                  <Toggle on={c.on} />
                </td>
                <td className="mono">{c.roi.toFixed(1)}x</td>
                <td>
                  <div className="row-h" style={{ gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: 'var(--panel3)', border: '1px solid var(--line)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: (c.strengthN * 100) + '%', height: '100%', background: 'var(--sky)' }} />
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>{c.strength}</div>
                  </div>
                </td>
                <td className="mono">{c.adstock.toFixed(2)}</td>
                <td className="dim" style={{ fontSize: 12.5 }}>{c.priorSource}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Channel detail panel */}
      <Card>
        <CardHead
          title={`Channel detail — ${sel.name}`}
          sub={`Prior source: ${sel.priorSource}`}
          icon={<I.Sliders size={14} />}
          actions={
            <>
              <Btn small kind="ghost">Reset to template</Btn>
              <Btn small kind="mint" leftIcon={<I.Check size={12} />}>Apply experiment result</Btn>
            </>
          }
        />
        <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <PriorEdit label="ROI PRIOR (μ)" help="The model’s starting belief about revenue per $1 spent on this channel."
              value={sel.roi} min={0} max={5} step={0.1} fmt={v => `${v.toFixed(2)}x`} onChange={v => editSel('roi', v)} />
            <PriorEdit label="PRIOR STRENGTH (σ)" help="How hard the brand’s own data can override this belief (higher = tighter prior)."
              value={sel.strengthN} min={0} max={1} step={0.05} fmt={v => `${v.toFixed(2)} · σ ${(1 - v).toFixed(2)}`} onChange={v => editSel('strengthN', v)} />
            <PriorEdit label="ADSTOCK / CARRY-OVER DECAY" help="How long this channel’s effect lingers after spend."
              value={sel.adstock} min={0} max={1} step={0.05} fmt={v => v.toFixed(2)} onChange={v => editSel('adstock', v)} />
            <div className="row-h" style={{ gap: 8, paddingTop: 8 }}>
              <Tag kind="sky">media type · {sel.medium.toLowerCase()}</Tag>
              {sel.priorSource.toLowerCase().includes('geo') || sel.priorSource.toLowerCase().includes('calibrated')
                ? <Tag kind="mint">calibrated</Tag>
                : <Tag>uncalibrated</Tag>}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Skel label="ROI prior distribution" height={160} />
            <Skel label="saturation (Hill) curve" height={160} />
          </div>
        </div>
      </Card>
    </div>
  );
};

const ControlVariables = () => {
  const d = TRIFECTA_DATA;
  const [ctrls, setCtrls] = React.useState(d.controls);
  const toggle = (id) => setCtrls(prev => prev.map(c => c.id === id ? { ...c, on: !c.on } : c));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Callout icon={<I.Info size={14} />}>
        Without controls, media takes credit for things it didn’t cause. Toggle each one on or off
        for this brand; the model is re-built when training next runs.
      </Callout>
      <Card>
        <CardHead title="Control variables" sub={`${ctrls.filter(c=>c.on).length} of ${ctrls.length} active`} icon={<I.Sliders size={14} />} />
        {ctrls.map((c, i) => (
          <div key={c.id} style={{ padding: '14px 18px', borderTop: '1px solid var(--line)', display: 'grid', gridTemplateColumns: '36px 1fr auto', alignItems: 'center', gap: 14 }}>
            <Toggle on={c.on} onClick={() => toggle(c.id)} />
            <div style={c.on ? {} : { opacity: 0.5 }}>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>{c.desc}</div>
            </div>
            <Tag kind={c.on ? 'mint' : 'default'}>{c.on ? 'included' : 'excluded'}</Tag>
          </div>
        ))}
      </Card>
    </div>
  );
};

const Calibration = () => {
  const d = TRIFECTA_DATA;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Callout icon={<I.Check size={14} />}>
        <strong>Geo-holdout test results are injected as priors</strong> so the model is anchored
        to measured causal lift — not just observational correlation.
      </Callout>
      <Card>
        <CardHead title="Calibration experiments" sub="Linked geo-holdout incrementality tests" icon={<I.Check size={14} />}
          actions={<Btn small kind="primary" leftIcon={<I.Plus size={12} />}>Add calibration</Btn>} />
        {d.calibrations.map((c, i) => (
          <div key={i} style={{ padding: '14px 18px', borderTop: '1px solid var(--line)' }}>
            <div className="between">
              <div>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div className="dim mono" style={{ fontSize: 11.5, marginTop: 2 }}>{c.period} → applied to {c.appliesTo}</div>
              </div>
              <div className="row-h" style={{ gap: 8 }}>
                <StatusTag status={c.status} />
                <Btn small kind="ghost">Open</Btn>
              </div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
};

const ModelSettings = () => {
  const d = TRIFECTA_DATA;
  return (
    <Card>
      <CardHead title="Model settings" sub="The structural choices that frame the whole MMM" icon={<I.Cog size={14} />} />
      <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 14 }}>
        {d.modelSettings.map(m => (
          <Field key={m.label} label={m.label} mono>
            {m.value}
          </Field>
        ))}
      </div>
    </Card>
  );
};

const Versions = () => {
  const d = TRIFECTA_DATA;
  return (
    <Card>
      <CardHead title="Model versions" sub="Each version is a saved configuration; diagnostics from its last training run" icon={<I.Layers size={14} />} />
      <table className="tbl">
        <thead>
          <tr>
            <th>Version</th>
            <th>Status</th>
            <th>Trained</th>
            <th>Diagnostics</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {d.versions.map(v => (
            <tr key={v.id}>
              <td>
                <div className="row-h" style={{ gap: 10 }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{v.id}</span>
                </div>
              </td>
              <td><StatusTag status={v.tag === 'Live' ? 'Live' : 'Archived'} /></td>
              <td className="mono dim" style={{ fontSize: 12 }}>{v.date}</td>
              <td className="dim" style={{ fontSize: 12.5 }}>{v.note}</td>
              <td>
                <Btn small kind="ghost" leftIcon={<I.Compare size={12} />}>Compare</Btn>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};

const ModelStudio = ({ client }) => {
  const [tab, setTab] = React.useState('channels');
  const [channels, setChannels] = React.useState(TRIFECTA_DATA.channels);
  const [configId, setConfigId] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState(null);
  const tabs = [
    { id: 'channels',    label: 'Channels & Priors' },
    { id: 'controls',    label: 'Control Variables' },
    { id: 'calibration', label: 'Calibration' },
    { id: 'settings',    label: 'Model Settings' },
    { id: 'versions',    label: 'Versions' },
  ];

  // The translation-layer-shaped config persisted to model_configs.
  const buildConfig = () => ({
    channels: channels.map(c => ({
      id: c.id, name: c.name, include: !!c.on,
      roi_prior_mean: c.roi, prior_strength: c.strengthN, adstock_decay: c.adstock, medium: c.medium,
    })),
    settings: { holdout_weeks: 8, confidence_level: 0.9 },
  });

  // Load the client's saved working configuration and merge its priors back in.
  React.useEffect(() => {
    if (!client?.dbId) return;
    let on = true;
    fetch(`/api/model-config?client_id=${client.dbId}`).then(r => r.ok ? r.json() : null).then(j => {
      if (!on || !j?.configs?.length) return;
      const saved = j.configs.find(c => c.name === 'Working configuration') || j.configs[0];
      if (!saved?.config?.channels?.length) return;
      setConfigId(saved.id);
      setChannels(prev => prev.map(c => {
        const s = saved.config.channels.find(x => x.id === c.id);
        return s ? { ...c, on: s.include, roi: s.roi_prior_mean ?? c.roi, strengthN: s.prior_strength ?? c.strengthN, adstock: s.adstock_decay ?? c.adstock } : c;
      }));
    }).catch(() => {});
    return () => { on = false; };
  }, [client?.dbId]);

  const saveConfig = async () => {
    if (!client?.dbId) { alert('This client isn’t backed by the live database yet.'); return; }
    setSaving(true);
    try {
      const cfg = buildConfig();
      if (configId) {
        const r = await fetch('/api/model-config', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: configId, config: cfg }) });
        if (!r.ok) throw new Error((await r.json()).error || 'save failed');
      } else {
        const r = await fetch('/api/model-config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: client.dbId, name: 'Working configuration', config: cfg }) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || 'save failed');
        setConfigId(j.config.id);
      }
      setSavedAt(new Date().toISOString().slice(11, 16));
    } catch (e) { alert('Could not save: ' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <StudioVersionBar />
      <div className="tabs">
        {tabs.map(t => (
          <div key={t.id} className={'tab' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>
            {t.label}
          </div>
        ))}
      </div>
      {tab === 'channels'    && <ChannelsAndPriors channels={channels} setChannels={setChannels} onSave={saveConfig} saving={saving} savedAt={savedAt} />}
      {tab === 'controls'    && <ControlVariables />}
      {tab === 'calibration' && <Calibration />}
      {tab === 'settings'    && <ModelSettings />}
      {tab === 'versions'    && <ModelVersions client={client} config={buildConfig()} configId={configId} />}
    </div>
  );
};


// ============================== screens-client-rest.jsx ==============================
// Training Runs, Results, Signal, Client Settings

const TrainingRuns = () => {
  const d = TRIFECTA_DATA;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Card>
        <CardHead title="Next training run" sub="Configure, then kick off the next Meridian run on Vertex AI" icon={<I.Play size={12} />} />
        <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Model version" mono value="Aeon MMM · v3" />
            <Field label="Data window" mono value="Jan 2024 – Apr 2026 · 122 wks" />
            <Field label="Compute target" mono value="Meridian · Vertex AI · GPU (a2-highgpu-1g)" />
            <Field label="Sampler" mono value="NUTS · 4 chains · 2,000 draws" />
            <Field label="Holdout" mono value="Last 8 weeks" />
            <Field label="Output destination" mono value="gs://trifecta-aeon-prod/posteriors/" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Btn kind="primary" leftIcon={<I.Play size={12} />} style={{ justifyContent: 'center' }}>Start training run</Btn>
            <Btn kind="ghost">Dry-run validation</Btn>
            <div className="dim" style={{ fontSize: 11.5, marginTop: 4 }}>
              <span className="row-h" style={{ gap: 6, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--sky)' }}><I.Info size={12} /></span>
                <span>Training runs on GPU as a batch job. The posterior artifact is saved to GCS and becomes the source for Results and Signal.</span>
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="Run history" sub={`${d.runs.length} runs · last 90 days`} icon={<I.Cpu size={14} />} />
        <table className="tbl">
          <thead>
            <tr>
              <th>Run ID</th>
              <th>Version</th>
              <th>Started</th>
              <th>Duration</th>
              <th>Status</th>
              <th>R̂</th>
              <th>Holdout MAPE</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {d.runs.map(r => (
              <tr key={r.id}>
                <td className="mono" style={{ fontWeight: 600 }}>{r.id}</td>
                <td className="mono">{r.v}</td>
                <td className="mono dim" style={{ fontSize: 12 }}>{r.started}</td>
                <td className="mono">{r.dur}</td>
                <td><StatusTag status={r.status} /></td>
                <td className="mono">{r.rhat}</td>
                <td className="mono">{r.mape}</td>
                <td><Btn small kind="ghost">Open</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

// -----------------------------------------------------------------------------
// (Results lives in screens-results.jsx — keeps this file slim.)

const Signal = () => {
  const d = TRIFECTA_DATA;
  const [tools, setTools] = React.useState(d.signalTools);
  const [preview, setPreview] = React.useState(false);
  const toggle = (i) => setTools(prev => prev.map((t, j) => j === i ? { ...t, on: !t.on } : t));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Callout icon={<I.Signal size={14} />}>
        <strong>Signal</strong> is the client-facing conversational decision layer — a chat
        interface built as an MCP server over the trained model. Choose which tools are exposed
        to this client.
      </Callout>

      <Card>
        <CardHead
          title="Exposed tools"
          sub={`${tools.filter(t => t.on).length} of ${tools.length} enabled for Aeon Skincare`}
          icon={<I.Signal size={14} />}
          actions={<Btn small kind="ghost" leftIcon={<I.ArrowRight size={12} />} onClick={() => setPreview(true)}>Preview Signal</Btn>}
        />
        <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {tools.map((t, i) => (
            <div key={t.name} style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--panel3)' }}>
              <div className="between">
                <div style={{ flex: 1, paddingRight: 12 }}>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>{t.desc}</div>
                </div>
                <Toggle on={t.on} onClick={() => toggle(i)} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead title="Client access" sub="People at Aeon Skincare with Signal access"
          icon={<I.Users size={14} />}
          actions={<Btn small kind="primary" leftIcon={<I.Plus size={12} />}>Invite</Btn>} />
        {d.clientAccess.map((u, i) => (
          <div key={u.email} style={{ padding: '12px 18px', borderTop: '1px solid var(--line)' }}>
            <div className="between">
              <div className="row-h" style={{ gap: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: 999, background: 'var(--panel3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--sky)', fontSize: 11 }} className="mono">
                  {u.email[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{u.email}</div>
                  <div className="dim" style={{ fontSize: 12 }}>{u.role}</div>
                </div>
              </div>
              <div className="row-h" style={{ gap: 8 }}>
                <Tag kind={u.access === 'Editor' ? 'sky' : 'default'}>{u.access}</Tag>
                <Btn small kind="ghost">Manage</Btn>
              </div>
            </div>
          </div>
        ))}
      </Card>

      {preview ? <SignalPreview tools={tools} onClose={() => setPreview(false)} /> : null}
    </div>
  );
};

// -----------------------------------------------------------------------------

const ClientSettings = () => {
  const d = TRIFECTA_DATA;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Card>
        <CardHead title="Engagement" sub="Commercial &amp; data-residency configuration for Aeon Skincare" icon={<I.Tag size={14} />} />
        <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          <Field label="Client legal name" mono>Aeon Skincare Pte. Ltd.</Field>
          <Field label="Engagement value" mono>USD 54,000 / year</Field>
          <Field label="Model refresh cadence" mono>Monthly</Field>
          <Field label="Contract term" mono>12 months · renews Feb 2027</Field>
          <Field label="Data residency" mono>Singapore (asia-southeast1)</Field>
          <Field label="GCP project" mono>trifecta-aeon-prod</Field>
        </div>
      </Card>

      <Card>
        <CardHead title="Client users" sub="Roles: Editor (can change scenarios) · Viewer (read-only)"
          icon={<I.Users size={14} />}
          actions={<Btn small kind="primary" leftIcon={<I.Plus size={12} />}>Invite</Btn>} />
        {d.clientAccess.map((u, i) => (
          <div key={u.email} style={{ padding: '12px 18px', borderTop: '1px solid var(--line)' }}>
            <div className="between">
              <div className="row-h" style={{ gap: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: 999, background: 'var(--panel3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--sky)', fontSize: 11 }} className="mono">
                  {u.email[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{u.email}</div>
                  <div className="dim" style={{ fontSize: 12 }}>{u.role}</div>
                </div>
              </div>
              <div className="row-h" style={{ gap: 8 }}>
                <Tag kind={u.access === 'Editor' ? 'sky' : 'default'}>{u.access}</Tag>
                <Btn small kind="ghost">Manage</Btn>
              </div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
};


// ============================== screens-results.jsx ==============================
// Results screens — wireframe sketches of each output chart.
// Wireframe fidelity: line work, flat fills, dashed grids, mono axis labels.
// No external chart libs — every shape is hand-drawn SVG.

// -----------------------------------------------------------------------------
// Channel palette — kept stable across all four result views.
const CHAN = [
  { id: 'base',   name: 'Base / organic', color: '#3a4663' },
  { id: 'tv',     name: 'TV',             color: '#e6b052' },
  { id: 'radio',  name: 'Radio',          color: '#c98568' },
  { id: 'print',  name: 'Print',          color: '#7e6a5a' },
  { id: 'ooh',    name: 'Out-of-Home',    color: '#b07e3d' },
  { id: 'meta',   name: 'Meta',           color: '#4f6ef2' },
  { id: 'yt',     name: 'YouTube',        color: '#7d9bff' },
  { id: 'tiktok', name: 'TikTok',         color: '#c773d6' },
  { id: 'search', name: 'Paid Search',    color: '#37d39b' },
];
const CHAN_BY_ID = Object.fromEntries(CHAN.map(c => [c.id, c]));

// Channels in the rough order of contribution (largest first), excl. base.
const MEDIA_CHANS = ['search','meta','yt','tv','tiktok','ooh','radio','print'];

// Deterministic pseudo-random (so the SVGs are stable).
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// Generate 26 weeks of stacked contribution data.
function buildContributionSeries() {
  const r = seeded(7);
  const weeks = 26;
  const channels = ['base', ...MEDIA_CHANS];
  // base ~ slow seasonal, others ~ low-freq noise scaled by share
  const shares = { base: 0.46, search: 0.13, meta: 0.10, yt: 0.07, tv: 0.09, tiktok: 0.04, ooh: 0.05, radio: 0.03, print: 0.03 };
  const totalAt = (w) => 1 + 0.18 * Math.sin((w / weeks) * Math.PI * 2 - 0.6) + 0.05 * Math.sin(w * 0.9);
  const series = channels.map(ch => {
    const arr = [];
    for (let w = 0; w < weeks; w++) {
      const t = totalAt(w);
      // unique wobble per channel
      const wobble = 0.85 + 0.3 * r() + 0.15 * Math.sin(w * (0.4 + channels.indexOf(ch) * 0.13));
      arr.push(shares[ch] * t * wobble);
    }
    return { id: ch, values: arr };
  });
  // Normalise so total per week is plausible revenue (SGD k)
  const scale = 38000; // ~ SGD k per week peak
  const stacked = [];
  const totals = [];
  for (let w = 0; w < weeks; w++) {
    let acc = 0;
    const col = [];
    series.forEach(s => {
      const v = s.values[w] * scale;
      col.push({ id: s.id, y0: acc, y1: acc + v });
      acc += v;
    });
    stacked.push(col);
    totals.push(acc);
  }
  return { weeks, stacked, totals };
}

const CONTRIB = buildContributionSeries();

// -----------------------------------------------------------------------------
// SVG chart frame helpers

const ChartFrame = ({ width, height, padding = { t: 14, r: 14, b: 28, l: 44 }, yTicks = [], xTicks = [], children, yLabel, xLabel }) => {
  const ix = padding.l, iy = padding.t;
  const iw = width - padding.l - padding.r;
  const ih = height - padding.t - padding.b;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height, display: 'block' }} fontFamily="var(--f-mono)" fontSize="9.5" fill="var(--faint)">
      {/* y grid */}
      {yTicks.map((t, i) => (
        <g key={'y' + i}>
          <line x1={ix} x2={ix + iw} y1={iy + ih - t.y * ih} y2={iy + ih - t.y * ih} stroke="var(--line)" strokeDasharray="2 3" />
          <text x={ix - 6} y={iy + ih - t.y * ih + 3} textAnchor="end">{t.label}</text>
        </g>
      ))}
      {/* axes */}
      <line x1={ix} x2={ix + iw} y1={iy + ih} y2={iy + ih} stroke="var(--line2)" />
      <line x1={ix} x2={ix} y1={iy} y2={iy + ih} stroke="var(--line2)" />
      {/* x ticks */}
      {xTicks.map((t, i) => (
        <text key={'x' + i} x={ix + t.x * iw} y={iy + ih + 14} textAnchor="middle">{t.label}</text>
      ))}
      {/* Inner plot transform */}
      <g transform={`translate(${ix} ${iy})`}>{children({ w: iw, h: ih })}</g>
      {yLabel ? <text x={10} y={iy + ih / 2} textAnchor="middle" transform={`rotate(-90 10 ${iy + ih / 2})`} fill="var(--faint)" style={{ letterSpacing: '0.12em' }}>{yLabel}</text> : null}
      {xLabel ? <text x={ix + iw / 2} y={height - 4} textAnchor="middle" fill="var(--faint)" style={{ letterSpacing: '0.12em' }}>{xLabel}</text> : null}
    </svg>
  );
};

const Legend = ({ items, style }) => (
  <div className="row-h" style={{ gap: 14, flexWrap: 'wrap', ...(style || {}) }}>
    {items.map(it => (
      <div key={it.id} className="row-h" style={{ gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, background: it.color, display: 'inline-block' }} />
        <span className="mono" style={{ fontSize: 11 }}>{it.name}</span>
      </div>
    ))}
  </div>
);

// -----------------------------------------------------------------------------
// 1) Channel Contribution — stacked weekly areas

const ContributionChart = ({ width = 720, height = 320 }) => {
  const { weeks, stacked, totals } = CONTRIB;
  const yMax = Math.max(...totals) * 1.08;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(y => ({ y, label: `${Math.round(y * yMax / 1000)}k` }));
  const monthLabels = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
  const xTicks = monthLabels.map((m, i) => ({ x: i / (monthLabels.length - 1), label: m }));

  // Build path strings per channel layer
  const channels = ['base', ...MEDIA_CHANS];
  const pathsByChan = {};
  channels.forEach(id => {
    let top = `M `, bot = ` L `;
    for (let w = 0; w < weeks; w++) {
      const x = (w / (weeks - 1));
      const seg = stacked[w].find(s => s.id === id);
      const y0 = 1 - seg.y0 / yMax;
      const y1 = 1 - seg.y1 / yMax;
      top += `${w === 0 ? '' : 'L '}${x} ${y1} `;
    }
    for (let w = weeks - 1; w >= 0; w--) {
      const x = (w / (weeks - 1));
      const seg = stacked[w].find(s => s.id === id);
      const y0 = 1 - seg.y0 / yMax;
      bot += `${w === weeks - 1 ? '' : 'L '}${x} ${y0} `;
    }
    pathsByChan[id] = top + bot + ' Z';
  });

  return (
    <ChartFrame
      width={width} height={height}
      yTicks={yTicks}
      xTicks={xTicks}
      yLabel="SGD / WEEK"
      xLabel="WEEK (nov 2025 → apr 2026)"
    >
      {({ w, h }) => (
        <g>
          {/* layers */}
          {channels.map(id => (
            <path key={id} d={pathsByChan[id]} transform={`scale(${w} ${h})`} fill={CHAN_BY_ID[id].color} opacity={id === 'base' ? 0.55 : 0.78} />
          ))}
          {/* total line on top */}
          <path
            d={'M ' + totals.map((t, i) => `${(i / (weeks - 1)) * w} ${(1 - t / yMax) * h}`).join(' L ')}
            fill="none" stroke="var(--text)" strokeWidth="1" opacity="0.45"
          />
          {/* selected-week marker */}
          <line x1={w * 0.74} x2={w * 0.74} y1={0} y2={h} stroke="var(--sky)" strokeDasharray="3 3" opacity="0.7" />
          <circle cx={w * 0.74} cy={(1 - totals[Math.round(0.74 * (weeks - 1))] / yMax) * h} r="3" fill="var(--sky)" />
        </g>
      )}
    </ChartFrame>
  );
};

const ContributionView = () => {
  // Aggregate contribution share per channel
  const totals = MEDIA_CHANS.concat(['base']).map(id => {
    const sum = CONTRIB.stacked.reduce((acc, col) => acc + (col.find(s => s.id === id).y1 - col.find(s => s.id === id).y0), 0);
    return { id, sum };
  });
  const grand = totals.reduce((a, b) => a + b.sum, 0);
  const sorted = [...totals].sort((a, b) => b.sum - a.sum);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
      <div>
        <ContributionChart />
        <Legend items={[CHAN_BY_ID.base, ...MEDIA_CHANS.map(id => CHAN_BY_ID[id])]} style={{ marginTop: 6, paddingLeft: 44 }} />
      </div>
      <Card>
        <CardHead title="Share of revenue" sub="Last 26 weeks · posterior mean" />
        <div style={{ padding: '6px 0' }}>
          {sorted.map(t => {
            const pct = (t.sum / grand) * 100;
            const ch = CHAN_BY_ID[t.id];
            return (
              <div key={t.id} style={{ padding: '8px 16px' }}>
                <div className="between" style={{ marginBottom: 4 }}>
                  <div className="row-h" style={{ gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: ch.color }} />
                    <span style={{ fontSize: 12 }}>{ch.name}</span>
                  </div>
                  <span className="mono" style={{ fontSize: 11.5 }}>{pct.toFixed(1)}%</span>
                </div>
                <div style={{ height: 4, background: 'var(--panel3)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: pct + '%', height: '100%', background: ch.color, opacity: 0.85 }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 2) ROI & Marginal ROI — horizontal bars with 90% CI

const ROI_DATA = [
  { id: 'search', roi: 3.4, m: 1.9, lo: 1.4, hi: 2.4 },
  { id: 'meta',   roi: 2.6, m: 1.7, lo: 1.2, hi: 2.2 },
  { id: 'yt',     roi: 3.1, m: 2.4, lo: 1.6, hi: 3.1 },
  { id: 'tv',     roi: 1.9, m: 1.1, lo: 0.6, hi: 1.7 },
  { id: 'tiktok', roi: 2.8, m: 2.6, lo: 1.5, hi: 3.6 },
  { id: 'ooh',    roi: 1.4, m: 0.8, lo: 0.3, hi: 1.3 },
  { id: 'radio',  roi: 1.5, m: 0.7, lo: 0.2, hi: 1.2 },
  { id: 'print',  roi: 1.1, m: 0.4, lo: 0.0, hi: 0.9 },
];

const ROIView = () => {
  const max = 4;
  const rowH = 28;
  const width = 720;
  const height = ROI_DATA.length * rowH + 36;
  const padL = 110, padR = 24, padT = 14, padB = 22;
  const iw = width - padL - padR;
  const xT = (v) => padL + (v / max) * iw;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
      <div>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height, display: 'block' }} fontFamily="var(--f-mono)" fontSize="10" fill="var(--faint)">
          {/* x grid */}
          {[0,1,2,3,4].map(v => (
            <g key={v}>
              <line x1={xT(v)} x2={xT(v)} y1={padT} y2={height - padB} stroke="var(--line)" strokeDasharray="2 3" />
              <text x={xT(v)} y={height - 6} textAnchor="middle">{v}x</text>
            </g>
          ))}
          <line x1={padL} x2={padL} y1={padT} y2={height - padB} stroke="var(--line2)" />
          {/* breakeven */}
          <line x1={xT(1)} x2={xT(1)} y1={padT} y2={height - padB} stroke="var(--red)" strokeDasharray="3 3" opacity="0.5" />
          <text x={xT(1) + 4} y={padT + 9} fill="var(--red)" opacity="0.8">break-even</text>

          {ROI_DATA.map((d, i) => {
            const y = padT + i * rowH + 6;
            const ch = CHAN_BY_ID[d.id];
            return (
              <g key={d.id}>
                <text x={padL - 10} y={y + 13} textAnchor="end" fill="var(--text)" fontFamily="var(--f-body)" fontSize="11.5">{ch.name}</text>
                {/* ROI solid bar (back) */}
                <rect x={padL} y={y} width={(d.roi / max) * iw} height="9" fill={ch.color} opacity="0.55" rx="1" />
                {/* Marginal ROI bar (front, narrower) */}
                <rect x={padL} y={y + 11} width={(d.m / max) * iw} height="5" fill={ch.color} rx="1" />
                {/* CI on marginal */}
                <line x1={xT(d.lo)} x2={xT(d.hi)} y1={y + 13.5} y2={y + 13.5} stroke="var(--text)" strokeWidth="1" opacity="0.7" />
                <line x1={xT(d.lo)} x2={xT(d.lo)} y1={y + 10} y2={y + 17} stroke="var(--text)" strokeWidth="1" opacity="0.7" />
                <line x1={xT(d.hi)} x2={xT(d.hi)} y1={y + 10} y2={y + 17} stroke="var(--text)" strokeWidth="1" opacity="0.7" />
                {/* value labels */}
                <text x={xT(d.roi) + 6} y={y + 7} fill="var(--text)" fontSize="9.5">{d.roi.toFixed(1)}x</text>
              </g>
            );
          })}
        </svg>
        <Legend
          style={{ paddingLeft: 110, marginTop: 4 }}
          items={[
            { id: 'a', name: 'ROI (average)', color: 'rgba(125,155,255,0.55)' },
            { id: 'b', name: 'Marginal ROI', color: 'var(--sky)' },
            { id: 'c', name: '90% credible interval', color: 'var(--text)' },
          ]}
        />
      </div>

      <Card>
        <CardHead title="Reading this" sub="What the two bars mean" />
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="row-h" style={{ gap: 8, marginBottom: 4 }}>
              <span style={{ width: 18, height: 8, background: 'rgba(125,155,255,0.55)', borderRadius: 1 }} />
              <span style={{ fontWeight: 600, fontSize: 12.5 }}>Average ROI</span>
            </div>
            <div className="dim" style={{ fontSize: 12 }}>Revenue per $1 across the full training window.</div>
          </div>
          <div>
            <div className="row-h" style={{ gap: 8, marginBottom: 4 }}>
              <span style={{ width: 18, height: 5, background: 'var(--sky)', borderRadius: 1 }} />
              <span style={{ fontWeight: 600, fontSize: 12.5 }}>Marginal ROI</span>
            </div>
            <div className="dim" style={{ fontSize: 12 }}>Revenue from the <em>next</em> $1 — usually lower because of diminishing returns.</div>
          </div>
          <div>
            <div className="row-h" style={{ gap: 8, marginBottom: 4 }}>
              <span style={{ width: 18, height: 1, background: 'var(--text)' }} />
              <span style={{ fontWeight: 600, fontSize: 12.5 }}>Error bar</span>
            </div>
            <div className="dim" style={{ fontSize: 12 }}>90% credible interval on Marginal ROI. Wider = less confident.</div>
          </div>
        </div>
      </Card>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 3) Response curves — Hill saturation curves, grid of small multiples + detail

const hillCurve = (alpha, gamma, x) => Math.pow(x, alpha) / (Math.pow(x, alpha) + Math.pow(gamma, alpha));

const CURVE_PARAMS = {
  search: { a: 2.4, g: 0.35, sat: 0.78 },
  meta:   { a: 2.0, g: 0.45, sat: 0.62 },
  yt:     { a: 1.8, g: 0.55, sat: 0.48 },
  tv:     { a: 1.4, g: 0.65, sat: 0.40 },
  tiktok: { a: 1.6, g: 0.50, sat: 0.35 },
  ooh:    { a: 1.5, g: 0.60, sat: 0.55 },
  radio:  { a: 1.4, g: 0.55, sat: 0.50 },
  print:  { a: 1.2, g: 0.70, sat: 0.30 },
};

const makeCurvePath = (id, w, h, samples = 60) => {
  const p = CURVE_PARAMS[id];
  let s = '';
  for (let i = 0; i <= samples; i++) {
    const x = i / samples;
    const y = hillCurve(p.a, p.g, x);
    s += (i === 0 ? 'M ' : 'L ') + (x * w).toFixed(2) + ' ' + ((1 - y) * h).toFixed(2) + ' ';
  }
  return s;
};

const SmallCurve = ({ id, selected, onClick }) => {
  const ch = CHAN_BY_ID[id];
  const W = 160, H = 100;
  const p = CURVE_PARAMS[id];
  const pad = { t: 8, r: 8, b: 18, l: 8 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const path = makeCurvePath(id, iw, ih);
  const opX = p.sat;
  const opY = 1 - hillCurve(p.a, p.g, p.sat);
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? 'rgba(125,155,255,0.08)' : 'var(--panel3)',
        border: '1px solid ' + (selected ? 'var(--line2)' : 'var(--line)'),
        borderRadius: 8,
        cursor: 'pointer',
        padding: '8px 10px',
      }}>
      <div className="between" style={{ marginBottom: 4 }}>
        <div className="row-h" style={{ gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: ch.color }} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>{ch.name}</span>
        </div>
        <span className="mono faint" style={{ fontSize: 10 }}>{Math.round(p.sat * 100)}%</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} fontFamily="var(--f-mono)" fontSize="8" fill="var(--faint)">
        <g transform={`translate(${pad.l} ${pad.t})`}>
          <line x1="0" x2={iw} y1={ih} y2={ih} stroke="var(--line2)" />
          <line x1="0" x2="0" y1="0" y2={ih} stroke="var(--line2)" />
          <line x1={opX * iw} x2={opX * iw} y1={0} y2={ih} stroke="var(--sky)" strokeDasharray="2 2" opacity="0.7" />
          <path d={path} fill="none" stroke={ch.color} strokeWidth="1.6" />
          <circle cx={opX * iw} cy={opY * ih} r="2.5" fill="var(--sky)" />
        </g>
        <text x={pad.l} y={H - 4}>spend →</text>
        <text x={W - pad.r} y={H - 4} textAnchor="end" fill="var(--sky)">op.</text>
      </svg>
    </div>
  );
};

const DetailCurve = ({ id }) => {
  const ch = CHAN_BY_ID[id];
  const p = CURVE_PARAMS[id];
  const W = 540, H = 280;
  const pad = { t: 16, r: 22, b: 30, l: 50 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const path = makeCurvePath(id, iw, ih, 80);
  // confidence band
  const lo = makeCurvePath(id, iw, ih, 80); // approximate: same curve offset
  // Build a smooth band by varying gamma slightly
  const bandLo = (() => {
    let s = '';
    for (let i = 0; i <= 80; i++) {
      const x = i / 80;
      const y = hillCurve(p.a, p.g * 1.18, x);
      s += (i === 0 ? 'M ' : 'L ') + (x * iw) + ' ' + ((1 - y) * ih) + ' ';
    }
    return s;
  })();
  const bandHi = (() => {
    let s = '';
    for (let i = 80; i >= 0; i--) {
      const x = i / 80;
      const y = hillCurve(p.a, p.g * 0.85, x);
      s += (i === 80 ? 'L ' : 'L ') + (x * iw) + ' ' + ((1 - y) * ih) + ' ';
    }
    return s;
  })();
  const opX = p.sat;
  const opY = 1 - hillCurve(p.a, p.g, p.sat);

  return (
    <div>
      <div className="between" style={{ marginBottom: 8 }}>
        <div className="row-h" style={{ gap: 10 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: ch.color }} />
          <div className="display" style={{ fontWeight: 700, fontSize: 16 }}>{ch.name} · response curve</div>
        </div>
        <div className="row-h" style={{ gap: 6 }}>
          <Tag kind="sky">half-saturation γ = {p.g.toFixed(2)}</Tag>
          <Tag>shape α = {p.a.toFixed(1)}</Tag>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }} fontFamily="var(--f-mono)" fontSize="9.5" fill="var(--faint)">
        {/* y grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={pad.t + (1 - t) * ih} y2={pad.t + (1 - t) * ih} stroke="var(--line)" strokeDasharray="2 3" />
            <text x={pad.l - 8} y={pad.t + (1 - t) * ih + 3} textAnchor="end">{Math.round(t * 100)}%</text>
          </g>
        ))}
        {/* axes */}
        <line x1={pad.l} x2={W - pad.r} y1={pad.t + ih} y2={pad.t + ih} stroke="var(--line2)" />
        <line x1={pad.l} x2={pad.l} y1={pad.t} y2={pad.t + ih} stroke="var(--line2)" />

        <g transform={`translate(${pad.l} ${pad.t})`}>
          {/* confidence band */}
          <path d={bandLo + ' ' + bandHi + ' Z'} fill={ch.color} opacity="0.12" />
          {/* main curve */}
          <path d={path} fill="none" stroke={ch.color} strokeWidth="2" />
          {/* operating point */}
          <line x1={opX * iw} x2={opX * iw} y1={0} y2={ih} stroke="var(--sky)" strokeDasharray="3 3" opacity="0.7" />
          <line x1={0} x2={opX * iw} y1={opY * ih} y2={opY * ih} stroke="var(--sky)" strokeDasharray="3 3" opacity="0.7" />
          <circle cx={opX * iw} cy={opY * ih} r="4" fill="var(--sky)" />
        </g>

        <text x={pad.l} y={H - 8}>weekly spend (SGD) →</text>
        <text x={W - pad.r} y={H - 8} textAnchor="end" fill="var(--sky)">current operating point: {Math.round(p.sat * 100)}% of saturation</text>
      </svg>
      <div className="grid g3" style={{ marginTop: 12 }}>
        <Field label="Current weekly spend" mono>SGD 24,500</Field>
        <Field label="% of saturation" mono>{Math.round(p.sat * 100)}%</Field>
        <Field label="Headroom to 80%" mono>+SGD {Math.round((0.8 - p.sat) * 30000).toLocaleString()}</Field>
      </div>
    </div>
  );
};

const ResponseView = () => {
  const [sel, setSel] = React.useState('meta');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
      <Card>
        <CardHead title="Channel detail" sub="Click any small chart to focus" icon={<I.Chart size={14} />} />
        <div className="card-pad">
          <DetailCurve id={sel} />
        </div>
      </Card>
      <div>
        <div className="mono faint" style={{ fontSize: 10.5, letterSpacing: '0.14em', marginBottom: 8 }}>ALL CHANNELS · SATURATION</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {MEDIA_CHANS.map(id => (
            <SmallCurve key={id} id={id} selected={sel === id} onClick={() => setSel(id)} />
          ))}
        </div>
        <div className="dim" style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
          Each curve plots channel response (revenue contribution) against weekly spend. The blue
          dot marks the current operating point — channels above ~80% are saturated.
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 4) Budget Optimiser — current vs recommended allocation

const OPT_DATA = [
  { id: 'search', cur: 22, rec: 19, mRoi: 1.9 },
  { id: 'meta',   cur: 14, rec: 21, mRoi: 1.7 },
  { id: 'yt',     cur:  8, rec: 12, mRoi: 2.4 },
  { id: 'tv',     cur: 24, rec: 27, mRoi: 1.1 },
  { id: 'tiktok', cur:  6, rec: 11, mRoi: 2.6 },
  { id: 'ooh',    cur:  9, rec:  5, mRoi: 0.8 },
  { id: 'radio',  cur:  7, rec:  3, mRoi: 0.7 },
  { id: 'print',  cur: 10, rec:  2, mRoi: 0.4 },
];

const StackedBar = ({ data, field, label }) => {
  const total = data.reduce((s, d) => s + d[field], 0);
  return (
    <div>
      <div className="between" style={{ marginBottom: 6 }}>
        <div className="mono faint" style={{ fontSize: 10.5, letterSpacing: '0.14em' }}>{label}</div>
        <div className="mono" style={{ fontSize: 11.5 }}>SGD 1.85m / 6 wks</div>
      </div>
      <div style={{ display: 'flex', height: 36, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--line)' }}>
        {data.map(d => {
          const ch = CHAN_BY_ID[d.id];
          return (
            <div key={d.id} style={{ width: `${(d[field] / total) * 100}%`, background: ch.color, opacity: 0.82, display: 'grid', placeItems: 'center', color: '#0a0f1d', fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 600 }}>
              {d[field] >= 6 ? `${d[field]}%` : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const OptimiserView = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <CardHead
          title="Allocation — current vs. recommended"
          sub="Flat 6-week budget; objective: maximise revenue at constant spend"
          icon={<I.Chart size={14} />}
        />
        <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <StackedBar data={OPT_DATA} field="cur" label="CURRENT ALLOCATION" />
          <StackedBar data={OPT_DATA} field="rec" label="RECOMMENDED ALLOCATION" />
          <Legend items={OPT_DATA.map(d => ({ ...CHAN_BY_ID[d.id] }))} />
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <Card>
          <CardHead title="Per-channel shift" sub="Sorted by absolute change · 90% credible interval on revenue impact" />
          <table className="tbl">
            <thead>
              <tr>
                <th>Channel</th>
                <th style={{ width: '11%' }}>Current</th>
                <th style={{ width: '11%' }}>Recommended</th>
                <th style={{ width: '24%' }}>Move</th>
                <th style={{ width: '11%' }}>Δ</th>
                <th style={{ width: '13%' }}>Marg. ROI</th>
              </tr>
            </thead>
            <tbody>
              {[...OPT_DATA].sort((a, b) => Math.abs(b.rec - b.cur) - Math.abs(a.rec - a.cur)).map(d => {
                const delta = d.rec - d.cur;
                const ch = CHAN_BY_ID[d.id];
                const maxAbs = 10;
                const w = Math.min(1, Math.abs(delta) / maxAbs);
                const isUp = delta > 0;
                return (
                  <tr key={d.id}>
                    <td>
                      <div className="row-h" style={{ gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: ch.color }} />
                        <span style={{ fontWeight: 600 }}>{ch.name}</span>
                      </div>
                    </td>
                    <td className="mono">{d.cur}%</td>
                    <td className="mono">{d.rec}%</td>
                    <td>
                      <div style={{ position: 'relative', height: 6, background: 'var(--panel3)', borderRadius: 999, border: '1px solid var(--line)' }}>
                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: 'var(--line2)' }} />
                        <div style={{
                          position: 'absolute', top: -1, bottom: -1,
                          left: isUp ? '50%' : `${50 - w * 50}%`,
                          width: `${w * 50}%`,
                          background: isUp ? 'var(--mint)' : 'var(--amber)',
                          borderRadius: 999, opacity: 0.85,
                        }} />
                      </div>
                    </td>
                    <td className="mono" style={{ color: isUp ? 'var(--mint)' : 'var(--amber)' }}>
                      {isUp ? '+' : ''}{delta}%
                    </td>
                    <td className="mono">{d.mRoi.toFixed(1)}x</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="tile">
            <div className="lbl">Projected lift</div>
            <div className="v mono" style={{ color: 'var(--mint)' }}>+4.2<span className="unit">% rev</span></div>
            <div className="dim" style={{ fontSize: 12 }}>90% CI: +1.9% … +6.6%</div>
          </div>
          <div className="tile">
            <div className="lbl">Budget envelope</div>
            <div className="v mono">SGD 1.85m</div>
            <div className="dim" style={{ fontSize: 12 }}>6 weeks · flat to current</div>
          </div>
          <div className="tile">
            <div className="lbl">Biggest moves</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.7, marginTop: 4 }}>
              <div className="row-h" style={{ gap: 6 }}><span style={{ color: 'var(--mint)' }}>↑</span> Meta <span className="mono faint">+7%</span></div>
              <div className="row-h" style={{ gap: 6 }}><span style={{ color: 'var(--amber)' }}>↓</span> Print <span className="mono faint">−8%</span></div>
              <div className="row-h" style={{ gap: 6 }}><span style={{ color: 'var(--amber)' }}>↓</span> Radio <span className="mono faint">−4%</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Container — replaces the placeholder Results

const Results = () => {
  const [tab, setTab] = React.useState('contribution');
  const tabs = [
    { id: 'contribution', label: 'Channel contribution' },
    { id: 'roi',          label: 'ROI & marginal ROI' },
    { id: 'response',     label: 'Response curves' },
    { id: 'optimiser',    label: 'Budget optimiser' },
  ];
  const active = tabs.find(t => t.id === tab);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="tabs">
        {tabs.map(t => (
          <div key={t.id} className={'tab' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>
            {t.label}
          </div>
        ))}
      </div>

      <Card>
        <CardHead
          title={active.label}
          sub="Read from the latest posterior · v3 · gs://trifecta-aeon-prod/posteriors/v3-2026-05-12.nc"
          icon={<I.Chart size={14} />}
          actions={
            <>
              <Btn small kind="ghost">Window: last 26 wks</Btn>
              <Btn small kind="primary" leftIcon={<I.ArrowRight size={12} />}>Export report</Btn>
            </>
          }
        />
        <div className="card-pad">
          {tab === 'contribution' && <ContributionView />}
          {tab === 'roi'          && <ROIView />}
          {tab === 'response'     && <ResponseView />}
          {tab === 'optimiser'    && <OptimiserView />}
          <div className="row-h" style={{ marginTop: 14, gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <Tag kind="sky">90% credible interval</Tag>
            <Tag>posterior · v3</Tag>
            <Tag>geo · National + 5 regions</Tag>
            <Tag>122 wks · weekly</Tag>
            <span className="dim mono" style={{ fontSize: 11, marginLeft: 'auto' }}>Every figure carries a 90% credible interval.</span>
          </div>
        </div>
      </Card>
    </div>
  );
};


// ============================== screens-reports.jsx ==============================
// Reports — generate quarterly/annual reports with human-in-the-loop editing.

// -----------------------------------------------------------------------------
// Data

const REPORT_SECTION_LIB = [
  {
    id: 'exec', title: 'Executive summary', icon: 'Info',
    story: "Aeon Skincare grew revenue 11% year-over-year in Q1 2026 despite a modest 4% lift in paid media spend, with Meta and YouTube emerging as the strongest contributors to incremental growth. Print and Radio continue to under-deliver against their cost; we recommend reallocating ~SGD 110k from these channels into Meta over Q2 to capture the headroom on its response curve.",
    dataLbl: 'KPIs', dataHint: 'Auto-pulled from posterior · revenue, paid share, top mover',
  },
  {
    id: 'drivers', title: 'What drove the quarter', icon: 'Chart',
    story: "Base demand carried 46% of revenue this quarter, in line with the trailing four-quarter average. Among paid drivers, the top three (Paid Search, Meta, TV) account for 32% of revenue. Paid Search remained the steady performer; Meta grew its contribution share by 2.1 percentage points following the March creative refresh.",
    dataLbl: 'Channel contribution', dataHint: 'Stacked weekly · last 13 weeks',
  },
  {
    id: 'roi', title: 'Channel ROI & marginal ROI', icon: 'Trending',
    story: "Three channels carry a marginal ROI above 1.5x with reasonable confidence: YouTube (2.4x), TikTok (2.6x) and Meta (1.7x). Paid Search remains profitable on average (3.4x) but the next marginal dollar is worth only 1.9x — diminishing returns are now material. TV and Out-of-Home both sit just above break-even.",
    dataLbl: 'ROI & marginal ROI', dataHint: '8 channels · 90% credible interval',
  },
  {
    id: 'budget', title: 'Recommended allocation', icon: 'Dollar',
    story: "Holding total Q2 spend flat at SGD 1.85m, the optimiser projects a +4.2% revenue lift (90% CI: +1.9% to +6.6%) from moving ~SGD 130k of weekly spend out of Print and Radio and into Meta, YouTube and TikTok. The recommendation is robust across alternative model specifications and remains the headline action for Q2.",
    dataLbl: 'Current vs recommended', dataHint: 'Reallocation visual',
  },
  {
    id: 'saturation', title: 'Saturation watch', icon: 'Funnel',
    story: "Paid Search now sits at ~78% of its half-saturation point — the response curve is visibly flattening. TV and YouTube remain in the steep portion of their curves with meaningful headroom. We recommend treating any further Paid Search increase as exploratory until a fresh geo-holdout is run.",
    dataLbl: 'Saturation by channel', dataHint: 'Hill curves · operating point',
  },
  {
    id: 'experiments', title: 'Calibration experiments', icon: 'Check',
    story: "The Meta geo-holdout completed in March 2026 returned a measured ROI of 2.4x ±0.4, applied as a calibration prior in model v3. A TikTok holdout is proposed for Q2 to anchor that channel's prior more strongly — its current prior is the weakest in the model.",
    dataLbl: 'Experiment log', dataHint: '2 applied · 1 proposed',
  },
  {
    id: 'changes', title: 'What changed since last quarter', icon: 'Compare',
    story: "Compared to Q4 2025, Meta's contribution share rose 2.1pp and Print fell 1.4pp. Model R-hat improved from 1.02 to 1.01 and holdout MAPE tightened from 11% to 9%. No structural changes to the model — same channels, same control set.",
    dataLbl: 'QoQ delta', dataHint: 'Contribution + diagnostics',
  },
  {
    id: 'appendix', title: 'Methodology & appendix', icon: 'Box',
    story: "MMM v3 trained on 122 weeks of weekly data (Jan 2024 – Apr 2026) with Google's open-source Meridian library, NUTS sampler, 4 chains. National + 5 regions. Holdout MAPE 9% on the last 8 weeks. Posterior artifact: v3-2026-05-12.nc. Every figure in this report carries a 90% credible interval.",
    dataLbl: 'Methodology block', dataHint: 'Model, data window, diagnostics',
  },
];

const REPORTS_HISTORY = [
  { id: 'r1', title: 'Q1 2026 — Quarterly Performance', type: 'Quarterly', period: 'Jan – Mar 2026', sentDate: '14 Apr 2026', status: 'Sent',     pages: 18, recipients: ['maya@aeonskincare.com','sam@aeonskincare.com'] },
  { id: 'r2', title: '2025 — Annual Review',            type: 'Annual',    period: 'Jan – Dec 2025', sentDate: '28 Jan 2026', status: 'Sent',     pages: 42, recipients: ['maya@aeonskincare.com','sam@aeonskincare.com'] },
  { id: 'r3', title: 'Q4 2025 — Quarterly Performance', type: 'Quarterly', period: 'Oct – Dec 2025', sentDate: '12 Jan 2026', status: 'Sent',     pages: 19, recipients: ['maya@aeonskincare.com'] },
  { id: 'r4', title: 'Q3 2025 — Quarterly Performance', type: 'Quarterly', period: 'Jul – Sep 2025', sentDate: '14 Oct 2025', status: 'Sent',     pages: 17, recipients: ['maya@aeonskincare.com'] },
  { id: 'r5', title: 'Q2 2025 — Quarterly Performance', type: 'Quarterly', period: 'Apr – Jun 2025', sentDate: '18 Jul 2025', status: 'Sent',     pages: 16, recipients: ['maya@aeonskincare.com'] },
];

// -----------------------------------------------------------------------------
// Mini data widgets that appear inside the section editor's "data preview"

const ContribMiniBar = () => (
  <>
    <div className="data-lbl">CHANNEL CONTRIBUTION · LAST 13 WKS</div>
    <div style={{ display: 'flex', height: 18, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--line)' }}>
      {[['#3a4663',46],['#37d39b',13],['#4f6ef2',10],['#e6b052',9],['#7d9bff',7],['#c773d6',4],['#b07e3d',5],['#c98568',3],['#7e6a5a',3]].map(([c,p],i) => (
        <div key={i} style={{ width: p+'%', background: c, opacity: 0.85 }} />
      ))}
    </div>
    <div className="dim" style={{ fontSize: 11.5 }}>Base 46% · Search 13% · Meta 10% · TV 9% · YouTube 7% · 4 more</div>
  </>
);

const KpiMini = () => (
  <>
    <div className="data-lbl">KEY FIGURES · Q1 2026</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {[
        ['Revenue', 'SGD 5.42m', 'var(--text)'],
        ['Paid share', '54%', 'var(--text)'],
        ['Top mover', 'Meta +2.1pp', 'var(--mint)'],
      ].map(([l,v,c],i) => (
        <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px' }}>
          <div className="mono faint" style={{ fontSize: 9.5, letterSpacing: '0.14em' }}>{l.toUpperCase()}</div>
          <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: c, marginTop: 2 }}>{v}</div>
        </div>
      ))}
    </div>
  </>
);

const RoiMini = () => (
  <>
    <div className="data-lbl">MARGINAL ROI · TOP 3</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[['TikTok',2.6,'#c773d6'],['YouTube',2.4,'#7d9bff'],['Meta',1.7,'#4f6ef2']].map(([n,v,c],i) => (
        <div key={i} className="between">
          <div className="row-h" style={{ gap: 8, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{n}
          </div>
          <span className="mono" style={{ fontSize: 11.5 }}>{v.toFixed(1)}x</span>
        </div>
      ))}
    </div>
  </>
);

const BudgetMini = () => (
  <>
    <div className="data-lbl">RECOMMENDED REALLOCATION</div>
    <div className="row-h" style={{ gap: 8, fontSize: 12 }}>
      <span style={{ color: 'var(--amber)' }}>↓ Print −8%</span>
      <span className="faint">·</span>
      <span style={{ color: 'var(--amber)' }}>↓ Radio −4%</span>
      <span className="faint">·</span>
      <span style={{ color: 'var(--mint)' }}>↑ Meta +7%</span>
    </div>
    <div className="mono" style={{ fontSize: 11.5, color: 'var(--mint)', marginTop: 4 }}>Projected lift +4.2% rev (CI: +1.9% → +6.6%)</div>
  </>
);

const ExperimentsMini = () => (
  <>
    <div className="data-lbl">EXPERIMENTS</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
      <div className="row-h" style={{ gap: 8 }}><Tag kind="mint">APPLIED</Tag> Meta geo-holdout · Mar 2026 · ROI 2.4x ±0.4</div>
      <div className="row-h" style={{ gap: 8 }}><Tag kind="mint">APPLIED</Tag> TV regional lift · Q4 2025</div>
      <div className="row-h" style={{ gap: 8 }}><Tag kind="amber">PROPOSED</Tag> TikTok holdout · Q2</div>
    </div>
  </>
);

const SaturationMini = () => (
  <>
    <div className="data-lbl">SATURATION · SHARE OF HALF-POINT</div>
    {[['Paid Search',78,'var(--amber)'],['TV',40,'var(--mint)'],['YouTube',48,'var(--mint)'],['Meta',62,'var(--sky)']].map(([n,p,c],i) => (
      <div key={i}>
        <div className="between" style={{ marginBottom: 2 }}>
          <span style={{ fontSize: 11.5 }}>{n}</span>
          <span className="mono" style={{ fontSize: 11 }}>{p}%</span>
        </div>
        <div style={{ height: 4, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 999 }}>
          <div style={{ width: p+'%', height: '100%', background: c, borderRadius: 999 }} />
        </div>
      </div>
    ))}
  </>
);

const ChangesMini = () => (
  <>
    <div className="data-lbl">QoQ DELTA</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
      <div className="between"><span>Meta share</span><span className="mono" style={{ color: 'var(--mint)' }}>+2.1pp</span></div>
      <div className="between"><span>Print share</span><span className="mono" style={{ color: 'var(--amber)' }}>−1.4pp</span></div>
      <div className="between"><span>Model R-hat</span><span className="mono">1.02 → 1.01</span></div>
      <div className="between"><span>Holdout MAPE</span><span className="mono">11% → 9%</span></div>
    </div>
  </>
);

const AppendixMini = () => (
  <>
    <div className="data-lbl">METHODOLOGY</div>
    <div className="mono" style={{ fontSize: 11, color: 'var(--dim)', lineHeight: 1.5 }}>
      Meridian · NUTS · 4 chains<br/>
      122 wks · Jan 2024 – Apr 2026<br/>
      National + 5 regions<br/>
      Holdout MAPE 9% · R-hat 1.01
    </div>
  </>
);

const DATA_PREVIEW_BY_ID = {
  exec: <KpiMini />,
  drivers: <ContribMiniBar />,
  roi: <RoiMini />,
  budget: <BudgetMini />,
  saturation: <SaturationMini />,
  experiments: <ExperimentsMini />,
  changes: <ChangesMini />,
  appendix: <AppendixMini />,
};

// -----------------------------------------------------------------------------
// Archive view

const ReportCard = ({ r, onOpen }) => (
  <Card style={{ padding: 14, cursor: 'pointer' }}>
    <div onClick={onOpen} className="report-thumb">
      <div className="t2">TRIFECTA · MMM</div>
      <div className="t1">{r.title.split(' — ')[0]}</div>
      <div className="t2">{r.period}</div>
      <div className="t-row" style={{ marginTop: 8 }}>
        <span style={{ flex: 3 }} /><span style={{ flex: 4 }} className="x" /><span style={{ flex: 2 }} />
      </div>
      <div className="t-row"><span style={{ flex: 5 }} className="x" /><span style={{ flex: 3 }} /></div>
      <div className="t-row"><span style={{ flex: 2 }} /><span style={{ flex: 6 }} className="x" /></div>
      <div className="t-bar" />
    </div>
    <div style={{ marginTop: 12 }}>
      <div className="between" style={{ marginBottom: 6 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.title}</div>
        <StatusTag status={r.status} />
      </div>
      <div className="dim mono" style={{ fontSize: 11 }}>{r.type.toUpperCase()} · {r.pages} PAGES · SENT {r.sentDate.toUpperCase()}</div>
      <div className="dim" style={{ fontSize: 11.5, marginTop: 4 }}>To: {r.recipients.join(', ')}</div>
      <div className="row-h" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <Btn small kind="ghost" leftIcon={<I.Download size={12} />}>PDF</Btn>
        <Btn small kind="ghost" leftIcon={<I.Send size={12} />}>Resend</Btn>
        <Btn small kind="ghost" leftIcon={<I.FileText size={12} />} onClick={onOpen} style={{ padding: '6px 8px' }} title="Duplicate"></Btn>
      </div>
    </div>
  </Card>
);

const ReportsArchive = ({ onNew, onOpen, client }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <Callout icon={<I.FileText size={14} />}>
      <strong>Quarterly &amp; annual reports.</strong> A PDF per quarter (and a long-form one each year) summarising what
      the model says. Every section is auto-populated from the latest posterior but the narrative is operator-edited
      before sending — so the story stays in your hands.
    </Callout>

    <div className="grid g4">
      <div className="tile">
        <div className="lbl">Reports sent</div>
        <div className="v mono">{REPORTS_HISTORY.length}</div>
        <div className="dim" style={{ fontSize: 12 }}>since {client.name} onboarded</div>
      </div>
      <div className="tile">
        <div className="lbl">Cadence</div>
        <div className="v mono">Q + A</div>
        <div className="dim" style={{ fontSize: 12 }}>Quarterly + Annual review</div>
      </div>
      <div className="tile">
        <div className="lbl">Last sent</div>
        <div className="v mono">14<span className="unit">Apr</span></div>
        <div className="dim" style={{ fontSize: 12 }}>Q1 2026 · 18 pages</div>
      </div>
      <div className="tile">
        <div className="lbl">Next due</div>
        <div className="v mono" style={{ color: 'var(--amber)' }}>14<span className="unit">Jul</span></div>
        <div className="dim" style={{ fontSize: 12 }}>Q2 2026 · drafts ready 10 Jul</div>
      </div>
    </div>

    <SectionHead
      title="All reports"
      sub="Most recent first. Click a report to preview, duplicate, or rebuild."
      actions={
        <>
          <div className="seg">
            <button className="on">All</button>
            <button>Quarterly</button>
            <button>Annual</button>
            <button>Drafts</button>
          </div>
          <Btn kind="primary" leftIcon={<I.Plus size={13} />} onClick={onNew}>New report</Btn>
        </>
      }
    />

    <div className="grid g3" style={{ gap: 14 }}>
      {REPORTS_HISTORY.map(r => <ReportCard key={r.id} r={r} onOpen={onOpen} />)}
    </div>
  </div>
);

// -----------------------------------------------------------------------------
// Section editor — the human-in-the-loop bit

const SectionEditor = ({ sec, index, included, story, onToggle, onStoryChange, onRegenerate, onMove, expanded, onExpand, isFirst, isLast }) => {
  const Ic = I[sec.icon] || I.FileText;
  return (
    <div className={'sec-card ' + (included ? 'included' : '')}>
      <div className="sec-head" onClick={onExpand}>
        <span className="sec-grip" title="Drag to reorder"><I.Grip size={14} /></span>
        <div className="sec-num">{included ? index : '—'}</div>
        <span style={{ color: included ? 'var(--sky)' : 'var(--faint)', display: 'inline-flex' }}><Ic size={14} /></span>
        <div className="sec-title">{sec.title}</div>
        {!included ? <Tag>excluded</Tag> : null}
        <div style={{ flex: 1 }} />
        <Btn small kind="ghost" onClick={e => { e.stopPropagation(); onMove(-1); }} style={{ visibility: isFirst ? 'hidden' : 'visible', padding: '4px 6px' }}><I.ChevronUp size={12} /></Btn>
        <Btn small kind="ghost" onClick={e => { e.stopPropagation(); onMove(1); }}  style={{ visibility: isLast  ? 'hidden' : 'visible', padding: '4px 6px' }}><I.Chevron  size={12} /></Btn>
        <span onClick={e => { e.stopPropagation(); onToggle(); }}><Toggle on={included} /></span>
        <span style={{ color: 'var(--faint)', display: 'inline-flex', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <I.Chevron size={14} />
        </span>
      </div>
      {expanded ? (
        <div className="sec-body">
          <div>
            <div className="mono faint" style={{ fontSize: 10, letterSpacing: '0.14em', marginBottom: 6 }}>DATA · {sec.dataLbl.toUpperCase()}</div>
            <div className="data-mini">
              {DATA_PREVIEW_BY_ID[sec.id]}
            </div>
            <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>{sec.dataHint} · pulls live from posterior v3.</div>
            <div className="row-h" style={{ gap: 6, marginTop: 8 }}>
              <Btn small kind="ghost" leftIcon={<I.Eye size={12} />}>Open in Results</Btn>
              <Btn small kind="ghost" leftIcon={<I.Compare size={12} />}>Swap chart</Btn>
            </div>
          </div>
          <div>
            <div className="mono faint" style={{ fontSize: 10, letterSpacing: '0.14em', marginBottom: 6 }}>STORY · OPERATOR-EDITABLE</div>
            <textarea
              className="story"
              value={story}
              onChange={e => onStoryChange(e.target.value)}
            />
            <div className="ai-row">
              <div className="row-h" style={{ gap: 8 }}>
                <Btn small kind="mint" leftIcon={<I.Sparkles size={11} />} onClick={onRegenerate}>Regenerate with Claude</Btn>
                <span className="meta">{story.trim().split(/\s+/).filter(Boolean).length} words</span>
              </div>
              <span className="meta">edited by RB · just now</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

// -----------------------------------------------------------------------------
// PDF preview pane (paper aesthetic)

const PaperCover = ({ title, period, client }) => (
  <div style={{ padding: '8px 0' }}>
    <div className="p-cover-sub">TRIFECTA · MMM · QUARTERLY REVIEW</div>
    <div className="p-cover-title">{title}</div>
    <div style={{ marginTop: 14, color: '#4f5773', fontSize: 11 }}>
      Prepared for <strong style={{ color: '#1d2030' }}>{client.name}</strong> · {period} · Model v3
    </div>
    <hr className="p-divider" />
  </div>
);

const PaperSection = ({ sec, story, pageNo }) => (
  <div style={{ marginTop: 16 }}>
    <div className="between" style={{ alignItems: 'baseline' }}>
      <div>
        <span className="p-eyebrow">SECTION {pageNo}</span>
        <h2 className="p-h2" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>{sec.title}</h2>
      </div>
      <div className="p-pageno">P. {pageNo + 1}</div>
    </div>
    {sec.id === 'exec' ? (
      <div className="p-kpi">
        <div><div className="l">REVENUE</div><div className="v">SGD 5.42m</div></div>
        <div><div className="l">PAID SHARE</div><div className="v">54%</div></div>
        <div><div className="l">TOP MOVER</div><div className="v" style={{ color: '#1c9a70' }}>Meta +2.1pp</div></div>
      </div>
    ) : (
      <div className="p-row" style={{ marginTop: 8 }}>
        <div className="p-chart">[ {sec.dataLbl} ]</div>
      </div>
    )}
    <div className="p-story">{story}</div>
  </div>
);

const ReportPreview = ({ title, period, sections, sectionState, client }) => {
  const includedSections = sections.filter(s => sectionState[s.id].included);
  return (
    <div className="paper">
      <PaperCover title={title || 'Q1 2026 — Quarterly Performance'} period={period} client={client} />
      {includedSections.map((s, i) => (
        <PaperSection key={s.id} sec={s} story={sectionState[s.id].story} pageNo={i + 1} />
      ))}
      <div style={{ marginTop: 22, paddingTop: 12, borderTop: '1px solid #ece8da', display: 'flex', justifyContent: 'space-between' }}>
        <div className="mono" style={{ fontSize: 9, color: '#8a8567', letterSpacing: '0.14em' }}>TRIFECTA CONSULTING · {new Date().getFullYear()}</div>
        <div className="mono" style={{ fontSize: 9, color: '#8a8567', letterSpacing: '0.14em' }}>{includedSections.length + 1} PAGES · 90% CI</div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Send dialog

const SendDialog = ({ title, recipientsDefault, onClose, onSend }) => {
  const [recips, setRecips] = React.useState(recipientsDefault);
  const [subject, setSubject] = React.useState(`Your Q1 2026 MMM report — ${title.split(' — ')[0] || 'Quarterly review'}`);
  const [body, setBody] = React.useState("Hi Maya,\n\nAttached is your Q1 2026 MMM report. Headline: revenue up 11% YoY, Meta and YouTube driving the incremental growth. We're recommending a small reallocation out of Print and Radio for Q2 — full detail in section 4.\n\nHappy to walk you through it whenever suits. As always, Signal can answer follow-up questions live.\n\nRajeev");
  const toggle = (e) => setRecips(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);
  const allCandidates = ['maya@aeonskincare.com','sam@aeonskincare.com','rajeev@trifecta.sg'];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--panel3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--sky)' }}>
            <I.Send size={15} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="display" style={{ fontWeight: 700, fontSize: 16 }}>Send report</div>
            <div className="dim" style={{ fontSize: 12 }}>Email the PDF to client viewers and file the sent copy in the archive.</div>
          </div>
          <button className="theme-toggle" onClick={onClose}><I.X size={13} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label>To</label>
            <div className="row-h" style={{ gap: 6, flexWrap: 'wrap', padding: 6, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--panel3)', minHeight: 38 }}>
              {recips.map(r => (
                <div key={r} className="row-h" style={{ gap: 6, padding: '3px 8px', background: 'var(--panel)', border: '1px solid var(--line2)', borderRadius: 999, fontSize: 12 }}>
                  <span className="mono">{r}</span>
                  <button onClick={() => toggle(r)} style={{ color: 'var(--faint)', display: 'inline-flex' }}><I.X size={10} /></button>
                </div>
              ))}
              {allCandidates.filter(c => !recips.includes(c)).map(c => (
                <button key={c} onClick={() => toggle(c)} className="row-h" style={{ gap: 4, padding: '3px 8px', border: '1px dashed var(--line2)', borderRadius: 999, fontSize: 11.5, color: 'var(--dim)', fontFamily: 'var(--f-mono)', cursor: 'pointer' }}>
                  <I.Plus size={10} /> {c}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Subject</label>
            <input className="input" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="field">
            <label>Message</label>
            <textarea className="story" style={{ minHeight: 160 }} value={body} onChange={e => setBody(e.target.value)} />
          </div>
          <div className="row-h" style={{ gap: 10, padding: '10px 12px', background: 'var(--panel3)', border: '1px solid var(--line)', borderRadius: 8 }}>
            <span style={{ color: 'var(--sky)', display: 'inline-flex' }}><I.FileText size={14} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{title || 'Q1-2026-Quarterly-Performance.pdf'}</div>
              <div className="dim mono" style={{ fontSize: 11 }}>Generated just now · auto-attached</div>
            </div>
            <Tag kind="mint">90% CI</Tag>
          </div>
        </div>
        <div className="modal-foot">
          <div className="dim mono" style={{ fontSize: 11 }}>Sends from rajeev@trifecta.sg · BCC archive</div>
          <div className="row-h" style={{ gap: 8 }}>
            <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
            <Btn kind="ghost" leftIcon={<I.Clock size={12} />}>Schedule…</Btn>
            <Btn kind="primary" leftIcon={<I.Send size={12} />} onClick={onSend}>Send &amp; archive</Btn>
          </div>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Report Builder

const buildInitialState = () => {
  const order = REPORT_SECTION_LIB.map(s => s.id);
  const sectionState = {};
  REPORT_SECTION_LIB.forEach(s => {
    sectionState[s.id] = {
      included: s.id !== 'changes' && s.id !== 'saturation', // 6 default
      story: s.story,
    };
  });
  return { order, sectionState };
};

const ReportBuilder = ({ client, onBack, onSent }) => {
  const [title, setTitle] = React.useState('Q1 2026 — Quarterly Performance');
  const [period, setPeriod] = React.useState('Jan – Mar 2026');
  const [type, setType] = React.useState('Quarterly');
  const [{ order, sectionState }, setBuild] = React.useState(buildInitialState);
  const [expanded, setExpanded] = React.useState('exec');
  const [showSend, setShowSend] = React.useState(false);

  const setSectionState = (id, patch) => {
    setBuild(prev => ({
      ...prev,
      sectionState: { ...prev.sectionState, [id]: { ...prev.sectionState[id], ...patch } }
    }));
  };

  const moveSection = (id, dir) => {
    setBuild(prev => {
      const i = prev.order.indexOf(id);
      const j = i + dir;
      if (j < 0 || j >= prev.order.length) return prev;
      const next = [...prev.order];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...prev, order: next };
    });
  };

  const sections = order.map(id => REPORT_SECTION_LIB.find(s => s.id === id));
  const includedCount = order.filter(id => sectionState[id].included).length;

  return (
    <div>
      {/* Builder header */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div className="row-h" style={{ gap: 14 }}>
          <button onClick={onBack} className="theme-toggle" title="Back"><I.ArrowRight size={13} style={{ transform: 'rotate(180deg)' }} /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              className="input"
              style={{ background: 'transparent', border: 0, padding: 0, fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 19, letterSpacing: '-0.01em', width: '100%' }}
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <div className="row-h" style={{ gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
              <Tag kind="sky">DRAFT</Tag>
              <span className="dim mono" style={{ fontSize: 11 }}>{client.name.toUpperCase()} · v3 POSTERIOR · {includedCount} SECTIONS</span>
            </div>
          </div>
        </div>
        <div className="row-h" style={{ gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <div className="seg">
            {['Quarterly','Annual'].map(t => (
              <button key={t} className={type === t ? 'on' : ''} onClick={() => setType(t)}>{t}</button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <Btn kind="ghost" leftIcon={<I.Eye size={12} />}>Preview fullscreen</Btn>
          <Btn kind="ghost">Save draft</Btn>
          <Btn kind="primary" leftIcon={<I.Send size={12} />} onClick={() => setShowSend(true)}>Send to client…</Btn>
        </div>
      </div>

      {/* Split: editor + preview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)', gap: 18, alignItems: 'flex-start' }}>
        {/* LEFT — section editor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div className="card" style={{ padding: 14 }}>
            <div className="grid g2" style={{ gap: 14 }}>
              <div className="field"><label>Reporting period</label>
                <select className="input" value={period} onChange={e => setPeriod(e.target.value)}>
                  {['Jan – Mar 2026','Oct – Dec 2025','Jul – Sep 2025','Apr – Jun 2025','Jan – Dec 2025'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="field"><label>Compared against</label>
                <select className="input">
                  {['Previous quarter','Same quarter last year','Trailing 12 months'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>

          <Callout icon={<I.Sparkles size={13} />}>
            <strong>Each section's story was drafted from the model — then it's yours.</strong> Edit the narrative
            inline, swap a chart, hide a section, or use Regenerate to pull a fresh draft from the latest posterior.
            Nothing leaves your hands until you click Send.
          </Callout>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sections.map((sec, i) => {
              const st = sectionState[sec.id];
              const includedIdx = order.slice(0, i + 1).filter(id => sectionState[id].included).length;
              return (
                <SectionEditor
                  key={sec.id}
                  sec={sec}
                  index={st.included ? includedIdx : '—'}
                  included={st.included}
                  story={st.story}
                  expanded={expanded === sec.id}
                  isFirst={i === 0}
                  isLast={i === sections.length - 1}
                  onToggle={() => setSectionState(sec.id, { included: !st.included })}
                  onStoryChange={(v) => setSectionState(sec.id, { story: v })}
                  onRegenerate={() => setSectionState(sec.id, { story: sec.story })}
                  onMove={(d) => moveSection(sec.id, d)}
                  onExpand={() => setExpanded(prev => prev === sec.id ? null : sec.id)}
                />
              );
            })}
          </div>

          <Btn kind="ghost" leftIcon={<I.Plus size={13} />}>Add custom section</Btn>
        </div>

        {/* RIGHT — live preview pane */}
        <div style={{ position: 'sticky', top: 78 }}>
          <div className="between" style={{ marginBottom: 8 }}>
            <div className="mono faint" style={{ fontSize: 10.5, letterSpacing: '0.14em' }}>LIVE PDF PREVIEW</div>
            <div className="row-h" style={{ gap: 6 }}>
              <Btn small kind="ghost" leftIcon={<I.Eye size={12} />}>Fullscreen</Btn>
              <Btn small kind="ghost" leftIcon={<I.Download size={12} />}>Download PDF</Btn>
            </div>
          </div>
          <div style={{ maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', borderRadius: 10, padding: 4 }}>
            <ReportPreview
              title={title}
              period={period}
              sections={REPORT_SECTION_LIB.filter(s => order.includes(s.id))}
              sectionState={sectionState}
              client={client}
            />
          </div>
        </div>
      </div>

      {showSend ? (
        <SendDialog
          title={title}
          recipientsDefault={['maya@aeonskincare.com','sam@aeonskincare.com']}
          onClose={() => setShowSend(false)}
          onSend={() => { setShowSend(false); onSent && onSent(); }}
        />
      ) : null}
    </div>
  );
};

// -----------------------------------------------------------------------------
// Top-level

const ReportsScreen = ({ client }) => {
  const [view, setView] = React.useState('archive');
  return view === 'archive'
    ? <ReportsArchive client={client} onNew={() => setView('builder')} onOpen={() => setView('builder')} />
    : <ReportBuilder client={client} onBack={() => setView('archive')} onSent={() => setView('archive')} />;
};


// ============================== screens-system.jsx ==============================
// Login + System Settings (Team, Auth, Infrastructure, Billing)

// Phase 0 demo gate — hardcoded single operator credential (client-side only;
// not real security — that's M3/Supabase auth).
const DEMO_EMAIL = 'rajeev@trifecta.sg';
const DEMO_PASSWORD = '12345678';

const Login = ({ onSignIn }) => {
  const [email, setEmail] = React.useState(DEMO_EMAIL);
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const submit = async (e) => {
    if (e) e.preventDefault();
    setError('');

    const sb = getSupabaseBrowser();
    if (sb) {
      // Real Supabase auth. onAuthStateChange in App flips the session on success.
      setBusy(true);
      const { error: err } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setBusy(false);
      if (err) setError(err.message || 'Invalid email or password.');
      // success path is handled by the auth listener; no onSignIn() needed.
      return;
    }

    // Fallback (Supabase not configured yet — "scaffold now, creds later"):
    // keep the Phase 0 demo credentials working so the branch stays testable.
    if (email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
      onSignIn();
    } else {
      setError('Invalid email or password.');
    }
  };

  const inputStyle = { flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', font: 'inherit' };

  return (
    <div className="login-bg">
      <form className="login-card" onSubmit={submit}>
        <div className="row-h" style={{ gap: 10, marginBottom: 4 }}>
          <Logo size={26} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, lineHeight: 1 }}>
            <div className="display" style={{ fontWeight: 800, letterSpacing: '0.06em', fontSize: 18, lineHeight: 1 }}>TRIFECTA</div>
            <div className="mono" style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--faint)', textTransform: 'uppercase', lineHeight: 1 }}>Part of <b style={{ color: 'var(--text)', fontWeight: 700 }}>Midpoint Global</b></div>
          </div>
        </div>
        <div>
          <div className="display" style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em' }}>Operator Console</div>
          <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>Sign in to continue.</div>
        </div>

        <div className="field">
          <label>Email</label>
          <div className="inset mono">
            <span style={{ color: 'var(--faint)' }}><I.Mail size={13} /></span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              style={inputStyle}
            />
          </div>
        </div>
        <div className="field">
          <label>Password</label>
          <div className="inset mono">
            <span style={{ color: 'var(--faint)' }}><I.Lock size={13} /></span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              autoFocus
              style={inputStyle}
            />
          </div>
        </div>

        {error ? (
          <div style={{ color: 'var(--red)', fontSize: 12, marginTop: -6 }}>{error}</div>
        ) : null}

        <Btn type="submit" kind="primary" disabled={busy} style={{ width: '100%', justifyContent: 'center', padding: '11px 16px', marginTop: 4, opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Btn>

        <div className="row-h faint" style={{ gap: 8, fontSize: 11.5, justifyContent: 'center', marginTop: 4 }}>
          <I.Shield size={12} /> Protected by 2-factor authentication
        </div>
      </form>
    </div>
  );
};

// -----------------------------------------------------------------------------

const SystemSettings = () => {
  const d = TRIFECTA_DATA;
  const [tab, setTab] = React.useState('team');
  const tabs = [
    { id: 'team',    label: 'Team & Access' },
    { id: 'auth',    label: 'Authentication' },
    { id: 'infra',   label: 'Infrastructure' },
    { id: 'billing', label: 'Billing' },
  ];
  return (
    <div>
      <div className="tabs">
        {tabs.map(t => (
          <div key={t.id} className={'tab' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>
            {t.label}
          </div>
        ))}
      </div>

      {tab === 'team' && <TeamAccess />}

      {tab === 'auth' && (
        <Card>
          <CardHead title="Authentication" sub="Operator access policies for this workspace" icon={<I.Shield size={14} />} />
          {[
            { name: 'Password policy',          desc: '12+ chars · 90-day rotation', on: true },
            { name: 'Two-factor authentication',desc: 'Required for all operators', on: true },
            { name: 'Single sign-on',           desc: 'Google Workspace · trifecta.sg', on: false },
            { name: 'Session timeout',          desc: 'Auto sign-out after 8 hours idle', on: true },
          ].map((r, i) => (
            <div key={r.name} style={{ padding: '14px 18px', borderTop: '1px solid var(--line)' }}>
              <div className="between">
                <div>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>{r.desc}</div>
                </div>
                <div className="row-h" style={{ gap: 10 }}>
                  <Tag kind={r.on ? 'mint' : 'default'}>{r.on ? 'on' : 'off'}</Tag>
                  <Toggle on={r.on} />
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {tab === 'infra' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Callout icon={<I.Cpu size={14} />}>
            <strong>How the platform connects to the Meridian stack.</strong> One isolated set per client — each
            engagement gets its own GCP project, BigQuery dataset, and GCS bucket.
          </Callout>
          <Card>
            <CardHead title="Infrastructure" sub="Backend connections — shared across the workspace" icon={<I.Cloud size={14} />} />
            {d.infra.map((r, i) => {
              const iconEl = ({
                database: <I.Database size={16} />,
                cloud:    <I.Cloud size={16} />,
                cpu:      <I.Cpu size={16} />,
                shield:   <I.Shield size={16} />,
              })[r.icon] || <I.Plug size={16} />;
              return (
                <div key={r.name} style={{ padding: '14px 18px', borderTop: '1px solid var(--line)' }}>
                  <div className="between">
                    <div className="row-h" style={{ gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--panel3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: r.status === 'Connected' ? 'var(--sky)' : 'var(--amber)' }}>
                        {iconEl}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.name}</div>
                        <div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>{r.desc}</div>
                      </div>
                    </div>
                    <div className="row-h" style={{ gap: 8 }}>
                      <StatusTag status={r.status} />
                      <Btn small kind="ghost">Configure</Btn>
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {tab === 'billing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card>
            <CardHead title="Plan" icon={<I.Tag size={14} />} />
            <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <Field label="Plan" mono>Operator · Growth</Field>
              <Field label="Renews" mono>14 Feb 2027</Field>
              <Field label="Workspace seats" mono>2 of 5 used</Field>
              <Field label="Client engagements" mono>4 active</Field>
            </div>
          </Card>

          <Card>
            <CardHead title="Usage this month" sub="May 2026 to date" icon={<I.Chart size={14} />} />
            <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <div className="tile" style={{ background: 'var(--panel3)' }}>
                <div className="lbl">GPU compute</div>
                <div className="v mono">34.5<span className="unit">hrs</span></div>
                <div className="dim" style={{ fontSize: 12 }}>Vertex AI · a2-highgpu-1g</div>
              </div>
              <div className="tile" style={{ background: 'var(--panel3)' }}>
                <div className="lbl">BigQuery storage</div>
                <div className="v mono">118<span className="unit">GB</span></div>
                <div className="dim" style={{ fontSize: 12 }}>Across 4 clients</div>
              </div>
              <div className="tile" style={{ background: 'var(--panel3)' }}>
                <div className="lbl">GCS posteriors</div>
                <div className="v mono">7.2<span className="unit">GB</span></div>
                <div className="dim" style={{ fontSize: 12 }}>Versioned · 30-day retention</div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead title="Billing contact" icon={<I.Mail size={14} />} />
            <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <Field label="Billing email" mono>billing@trifecta.sg</Field>
              <Field label="Payment method" mono>Bank transfer · invoice</Field>
              <Field label="Tax ID (SG)" mono>202412345R</Field>
              <Field label="Currency" mono>SGD</Field>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};


// ============================== signal-preview.jsx ==============================
// Signal Preview — client-facing chat-with-the-MMM modal mockup.

const SP_COLORS = {
  base:   '#3a4663',
  search: '#37d39b',
  meta:   '#4f6ef2',
  yt:     '#7d9bff',
  tv:     '#e6b052',
  tiktok: '#c773d6',
  ooh:    '#b07e3d',
  radio:  '#c98568',
  print:  '#7e6a5a',
};

// --- Inline mini-result widgets that appear inside chat bubbles ----------

const MiniContributionBar = () => {
  const data = [
    { id: 'base',   pct: 46, label: 'Base / organic' },
    { id: 'search', pct: 13, label: 'Paid Search' },
    { id: 'meta',   pct: 10, label: 'Meta' },
    { id: 'tv',     pct:  9, label: 'TV' },
    { id: 'yt',     pct:  7, label: 'YouTube' },
    { id: 'ooh',    pct:  5, label: 'Out-of-Home' },
    { id: 'tiktok', pct:  4, label: 'TikTok' },
    { id: 'radio',  pct:  3, label: 'Radio' },
    { id: 'print',  pct:  3, label: 'Print' },
  ];
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', height: 22, borderRadius: 5, overflow: 'hidden', border: '1px solid var(--line)' }}>
        {data.map(d => (
          <div key={d.id} style={{ width: `${d.pct}%`, background: SP_COLORS[d.id], opacity: 0.85 }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {data.slice(0, 5).map(d => (
          <div key={d.id} className="row-h" style={{ gap: 6, fontSize: 11, whiteSpace: 'nowrap' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: SP_COLORS[d.id] }} />
            <span>{d.label}</span>
            <span className="mono faint">{d.pct}%</span>
          </div>
        ))}
        <div className="mono faint" style={{ fontSize: 11 }}>+ 4 more</div>
      </div>
    </div>
  );
};

const MiniROIRow = ({ name, roi, mroi, color }) => (
  <div style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
    <div className="between" style={{ marginBottom: 4 }}>
      <div className="row-h" style={{ gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{name}</span>
      </div>
      <span className="mono" style={{ fontSize: 11.5 }}>{roi.toFixed(1)}x · marg {mroi.toFixed(1)}x</span>
    </div>
    <div style={{ height: 4, background: 'var(--panel3)', borderRadius: 999, position: 'relative' }}>
      <div style={{ position: 'absolute', height: '100%', width: `${(roi / 4) * 100}%`, background: color, opacity: 0.45, borderRadius: 999 }} />
      <div style={{ position: 'absolute', height: '100%', width: `${(mroi / 4) * 100}%`, background: color, borderRadius: 999 }} />
    </div>
  </div>
);

const ScenarioResult = () => (
  <div style={{ marginTop: 10, padding: 12, background: 'var(--panel3)', border: '1px solid var(--line)', borderRadius: 8 }}>
    <div className="mono faint" style={{ fontSize: 10.5, letterSpacing: '0.14em', marginBottom: 8 }}>SCENARIO · MOVE SGD 50,000 FROM PRINT → META</div>
    <div className="row-h" style={{ gap: 18, alignItems: 'flex-end' }}>
      <div>
        <div className="mono faint" style={{ fontSize: 10, letterSpacing: '0.14em' }}>PROJECTED REVENUE</div>
        <div className="display" style={{ fontWeight: 700, fontSize: 22, color: 'var(--mint)' }}>+SGD 84,000</div>
      </div>
      <div>
        <div className="mono faint" style={{ fontSize: 10, letterSpacing: '0.14em' }}>90% CI</div>
        <div className="mono" style={{ fontSize: 13 }}>+SGD 41k … +SGD 138k</div>
      </div>
      <div>
        <div className="mono faint" style={{ fontSize: 10, letterSpacing: '0.14em' }}>CONFIDENCE</div>
        <div className="row-h" style={{ gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--mint)' }} />
          <span style={{ fontSize: 12.5 }}>High</span>
        </div>
      </div>
    </div>
    <div className="dim" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.5 }}>
      Print is at the flat tail of its saturation curve; Meta still has headroom. Most of the
      lift comes from Meta's marginal ROI of <span className="mono">1.7x</span> vs Print's
      <span className="mono"> 0.4x</span>.
    </div>
  </div>
);

const ToolBadge = ({ name }) => (
  <div className="row-h" style={{ gap: 6, padding: '3px 8px', background: 'rgba(79,110,242,0.08)', border: '1px solid rgba(79,110,242,0.25)', borderRadius: 999, fontSize: 10.5, color: 'var(--sky)', fontFamily: 'var(--f-mono)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
    <I.Plug size={10} /> {name}
  </div>
);

// --- The conversation -----------------------------------------------------

const TRANSCRIPT = [
  {
    role: 'assistant', kind: 'greeting',
    text: "Hi Maya — I'm Signal, connected to Aeon's MMM (v3, trained 12 May). Ask me about contribution, ROI, scenarios or budget. Every figure I give carries a 90% credible interval.",
  },
  {
    role: 'user',
    text: 'What drove revenue last quarter?',
  },
  {
    role: 'assistant',
    tool: 'Channel contribution',
    text: "Over Feb–Apr 2026, ~46% of revenue is base demand. Of the rest, the four largest paid drivers were Paid Search, Meta, TV and YouTube — together accounting for ~40% of revenue.",
    widget: <MiniContributionBar />,
  },
  {
    role: 'user',
    text: 'Which channels have headroom to spend more right now?',
  },
  {
    role: 'assistant',
    tool: 'Marginal ROI',
    text: "Three channels have a marginal ROI above 1.5x with reasonable confidence:",
    widget: (
      <div style={{ marginTop: 8 }}>
        <MiniROIRow name="TikTok"  roi={2.8} mroi={2.6} color={SP_COLORS.tiktok} />
        <MiniROIRow name="YouTube" roi={3.1} mroi={2.4} color={SP_COLORS.yt} />
        <MiniROIRow name="Meta"    roi={2.6} mroi={1.7} color={SP_COLORS.meta} />
        <div className="dim" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.5 }}>
          Paid Search is profitable on average but is already past its half-saturation point;
          the next dollar there is only worth ~SGD 1.90.
        </div>
      </div>
    ),
  },
  {
    role: 'user',
    text: 'If I move SGD 50k from Print into Meta for the next 6 weeks, what happens?',
  },
  {
    role: 'assistant',
    tool: 'Budget scenario',
    text: "I expect revenue to lift by ~SGD 84k over the 6 weeks (about a 2.5% increase). The 90% credible interval spans +SGD 41k to +SGD 138k.",
    widget: <ScenarioResult />,
  },
];

// --- The modal shell ------------------------------------------------------

const SignalPreview = ({ tools, onClose }) => {
  const [input, setInput] = React.useState('');
  const enabledTools = tools.filter(t => t.on);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        {/* Header: client brand frame */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--panel)' }}>
          <Logo size={20} />
          <div style={{ flex: 1 }}>
            <div className="row-h" style={{ gap: 8 }}>
              <div className="display" style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.005em' }}>Signal · Aeon Skincare</div>
              <Tag kind="mint" dot>LIVE</Tag>
              <Tag kind="sky">PREVIEW</Tag>
            </div>
            <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
              maya@aeonskincare.com · MMM v3 · last refresh 12 May
            </div>
          </div>
          <button className="theme-toggle" onClick={onClose} title="Close">
            <I.Plus size={14} style={{ transform: 'rotate(45deg)' }} />
          </button>
        </div>

        {/* Enabled tools strip */}
        <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--line)', background: 'var(--panel3)' }}>
          <div className="row-h" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span className="mono faint" style={{ fontSize: 10.5, letterSpacing: '0.14em', marginRight: 4 }}>EXPOSED TOOLS</span>
            {enabledTools.length === 0 ? (
              <span className="dim" style={{ fontSize: 12 }}>No tools enabled — Maya will only see this header.</span>
            ) : enabledTools.map(t => <ToolBadge key={t.name} name={t.name} />)}
          </div>
        </div>

        {/* Transcript */}
        <div style={{ padding: '18px 18px 8px', maxHeight: 460, overflowY: 'auto', background: 'var(--bg)' }}>
          {TRANSCRIPT.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
              <div style={{
                maxWidth: '88%',
                background: m.role === 'user' ? 'var(--blue)' : 'var(--panel)',
                color: m.role === 'user' ? '#fff' : 'var(--text)',
                border: m.role === 'user' ? '1px solid var(--blue)' : '1px solid var(--line)',
                borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                padding: '10px 14px',
                fontSize: 13,
                lineHeight: 1.55,
              }}>
                {m.tool ? (
                  <div className="row-h" style={{ gap: 6, marginBottom: 6 }}>
                    <ToolBadge name={m.tool} />
                  </div>
                ) : null}
                <div>{m.text}</div>
                {m.widget}
                {m.role === 'assistant' && m.kind !== 'greeting' ? (
                  <div className="row-h" style={{ gap: 12, marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                    <span className="mono faint" style={{ fontSize: 10, letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>POSTERIOR v3 · 90% CI</span>
                    <button style={{ fontSize: 11, color: 'var(--sky)', cursor: 'pointer', background: 'transparent', border: 0, padding: 0, whiteSpace: 'nowrap' }}>Save to decision log →</button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* Input (mocked) */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--line)', background: 'var(--panel)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--panel3)', border: '1px solid var(--line)', borderRadius: 999,
            padding: '6px 6px 6px 14px',
          }}>
            <input
              className="input mono"
              style={{ background: 'transparent', border: 0, padding: 0, fontSize: 13, fontFamily: 'var(--f-body)' }}
              placeholder="Ask Signal about contribution, ROI, scenarios…"
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <button style={{
              width: 30, height: 30, borderRadius: 999,
              background: input ? 'var(--blue)' : 'var(--panel)',
              color: input ? '#fff' : 'var(--faint)',
              border: '1px solid ' + (input ? 'var(--blue)' : 'var(--line)'),
              display: 'grid', placeItems: 'center', cursor: 'pointer',
            }}>
              <I.ArrowRight size={13} />
            </button>
          </div>
          <div className="dim" style={{ fontSize: 11, marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>Preview mode — replies are scripted. Live Signal uses the latest posterior on Vertex AI.</span>
            <span className="mono">⌘↵ to send</span>
          </div>
        </div>
      </div>
    </div>
  );
};


// ============================== add-client.jsx ==============================
// Add Client wizard — 6-step modal.

const WIZ_STEPS = [
  { id: 'client',      label: 'Client'        },
  { id: 'template',    label: 'Template'      },
  { id: 'channels',    label: 'Channels'      },
  { id: 'sources',     label: 'Data sources'  },
  { id: 'engagement',  label: 'Engagement'    },
  { id: 'review',      label: 'Review'        },
];

// Pre-built channel sets per archetype.
const TEMPLATE_CHANNELS = {
  dtc:    ['Paid Search','Meta','YouTube','TikTok','Programmatic','Affiliate','Influencer','Podcasts'],
  fmcg:   ['TV','Radio','OOH','Print','Cinema','Paid Search','Meta','YouTube','Programmatic','Trade promo','Sampling'],
  saas:   ['Paid Search','LinkedIn','Display','Content / SEO','Webinars','Outbound','Events'],
  travel: ['Paid Search','Meta','Affiliate','TV','OOH','Programmatic','Email','YouTube','Display'],
};

const DEFAULT_METHODS = {
  // sensible defaults — same channel can pick any method
  'Paid Search': 'API', 'Meta': 'API', 'YouTube': 'API', 'TikTok': 'API', 'LinkedIn': 'API',
  'Programmatic': 'Upload', 'Affiliate': 'Upload', 'Influencer': 'Upload', 'Podcasts': 'Upload',
  'Display': 'API', 'Content / SEO': 'Warehouse', 'Webinars': 'Upload', 'Outbound': 'Warehouse', 'Events': 'Manual entry',
  'TV': 'Feed', 'Radio': 'Upload', 'OOH': 'Upload', 'Print': 'Upload', 'Cinema': 'Manual entry',
  'Trade promo': 'Upload', 'Sampling': 'Manual entry', 'Email': 'Warehouse',
};

const METHOD_OPTIONS = ['API', 'Feed', 'Upload', 'Manual entry', 'Warehouse'];

const slug = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// -----------------------------------------------------------------------------
// Stepper

const Stepper = ({ step }) => (
  <div className="stepper">
    {WIZ_STEPS.map((s, i) => {
      const cls = i === step ? 'active' : (i < step ? 'done' : '');
      return (
        <React.Fragment key={s.id}>
          <div className={'s ' + cls}>
            <div className="n">{i < step ? <I.Check size={11} /> : i + 1}</div>
            <div>{s.label}</div>
          </div>
          {i < WIZ_STEPS.length - 1 ? <div className={'bar' + (i < step ? ' done' : '')} /> : null}
        </React.Fragment>
      );
    })}
  </div>
);

// -----------------------------------------------------------------------------
// Step 1 — Client basics

const StepClient = ({ form, setForm }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <div>
      <div className="display" style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Tell us about the client</div>
      <div className="dim" style={{ fontSize: 12.5 }}>A few basics so we can spin up the workspace and choose sensible defaults.</div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div className="field">
        <label>Display name</label>
        <input className="input" placeholder="e.g. Stellar Cosmetics"
          value={form.displayName}
          onChange={e => setForm({ ...form, displayName: e.target.value, gcpProject: 'trifecta-' + slug(e.target.value) + '-prod' })} />
      </div>
      <div className="field">
        <label>Legal name</label>
        <input className="input" placeholder="e.g. Stellar Cosmetics Pte. Ltd."
          value={form.legalName} onChange={e => setForm({ ...form, legalName: e.target.value })} />
      </div>
      <div className="field">
        <label>Industry / category</label>
        <select className="input" value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })}>
          {['Beauty & Personal Care','Food & Beverage','Home & Garden','Fashion & Apparel','Subscription / SaaS','Travel & Hospitality','Automotive','Telco','Financial Services','Other'].map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Primary geography</label>
        <select className="input" value={form.region} onChange={e => setForm({ ...form, region: e.target.value })}>
          {['Singapore','Malaysia','Indonesia','Thailand','Australia','United Kingdom','United States'].map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Outcome / KPI</label>
        <select className="input" value={form.kpi} onChange={e => setForm({ ...form, kpi: e.target.value })}>
          {['Revenue','Units sold','New customers','Subscriptions','Bookings'].map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Currency</label>
        <select className="input mono" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
          {['SGD','MYR','IDR','THB','AUD','GBP','USD','EUR'].map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Primary contact — name</label>
        <input className="input" placeholder="e.g. Maya Tan"
          value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} />
      </div>
      <div className="field">
        <label>Primary contact — email</label>
        <input className="input mono" placeholder="maya@brand.com"
          value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} />
      </div>
    </div>
  </div>
);

// -----------------------------------------------------------------------------
// Step 2 — Model template

const StepTemplate = ({ form, setForm }) => {
  const templates = TRIFECTA_DATA.modelLibrary.map(t => ({ ...t }));
  templates.push({ id: 'blank', name: 'Start from blank', desc: 'No defaults', channels: 0, clients: 0, tags: ['Custom'] });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="display" style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Pick a starting template</div>
        <div className="dim" style={{ fontSize: 12.5 }}>A reusable archetype from Model Library — channels, priors and adstock defaults. Tune everything in Model Studio later.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {templates.map(t => (
          <div key={t.id} className={'choice' + (form.templateId === t.id ? ' selected' : '')}
            onClick={() => setForm({ ...form, templateId: t.id })}>
            <div className="between" style={{ marginBottom: 10 }}>
              <div className="row-h" style={{ gap: 10 }}>
                <div className="check"><I.Check size={11} /></div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                  <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>{t.desc}</div>
                </div>
              </div>
              {t.id !== 'blank' ? (
                <div className="mono faint" style={{ fontSize: 10.5, letterSpacing: '0.14em', textAlign: 'right' }}>
                  {t.channels} CH · {t.clients} CLIENT{t.clients !== 1 ? 'S' : ''}
                </div>
              ) : null}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {t.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Step 3 — Channels

const StepChannels = ({ form, setForm }) => {
  const channels = form.templateId === 'blank'
    ? ['Paid Search','Meta','YouTube','TV','OOH','Programmatic']
    : (TEMPLATE_CHANNELS[form.templateId] || []);

  // Initialise toggles if not set
  React.useEffect(() => {
    const init = {};
    channels.forEach(c => { init[c] = form.channels[c] !== undefined ? form.channels[c] : true; });
    setForm({ ...form, channels: init });
    // eslint-disable-next-line
  }, [form.templateId]);

  const toggle = (c) => setForm({ ...form, channels: { ...form.channels, [c]: !form.channels[c] } });
  const onCount = Object.values(form.channels).filter(Boolean).length;
  const totalCount = Object.keys(form.channels).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="between">
        <div>
          <div className="display" style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Confirm channels</div>
          <div className="dim" style={{ fontSize: 12.5 }}>Drop or add channels you don't run yet. You can change this later in Model Studio.</div>
        </div>
        <Tag kind="sky">{onCount} of {totalCount} included</Tag>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {channels.map(c => {
          const on = !!form.channels[c];
          return (
            <div key={c} className={'choice' + (on ? ' selected' : '')} onClick={() => toggle(c)} style={{ padding: '12px 14px' }}>
              <div className="between">
                <div className="row-h" style={{ gap: 10 }}>
                  <div className="check"><I.Check size={11} /></div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c}</div>
                </div>
                <Tag>{['TV','Radio','OOH','Print','Cinema','Trade promo','Sampling'].includes(c) ? 'Traditional' : 'Digital'}</Tag>
              </div>
            </div>
          );
        })}
      </div>
      <Callout icon={<I.Info size={13} />}>
        Excluded channels stay in the workspace as drafts — easy to add back later when the agency starts buying them.
      </Callout>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Step 4 — Data sources

const StepSources = ({ form, setForm }) => {
  const channels = Object.keys(form.channels).filter(c => form.channels[c]);

  // Init methods
  React.useEffect(() => {
    const init = { ...form.methods };
    channels.forEach(c => { if (!init[c]) init[c] = DEFAULT_METHODS[c] || 'Upload'; });
    setForm({ ...form, methods: init });
    // eslint-disable-next-line
  }, [JSON.stringify(channels)]);

  const setMethod = (ch, m) => setForm({ ...form, methods: { ...form.methods, [ch]: m } });

  const counts = METHOD_OPTIONS.reduce((acc, m) => {
    acc[m] = channels.filter(c => form.methods[c] === m).length;
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="display" style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>How will each source reach us?</div>
        <div className="dim" style={{ fontSize: 12.5 }}>Connection method is independent of channel type — anything without an API arrives as a spreadsheet, exactly like TV. Pick what's true today; we'll set up the recipe later.</div>
      </div>

      <div className="grid g4" style={{ gap: 8 }}>
        {METHOD_OPTIONS.map(m => (
          <div key={m} className="tile" style={{ padding: '10px 12px' }}>
            <div className="lbl">{m}</div>
            <div className="mono" style={{ fontSize: 16, fontFamily: 'var(--f-display)', fontWeight: 700 }}>{counts[m]}</div>
          </div>
        ))}
        <div className="tile" style={{ padding: '10px 12px' }}>
          <div className="lbl">Total</div>
          <div className="mono" style={{ fontSize: 16, fontFamily: 'var(--f-display)', fontWeight: 700 }}>{channels.length}</div>
        </div>
      </div>

      <Card>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: '30%' }}>Channel</th>
              <th>Connection method</th>
            </tr>
          </thead>
          <tbody>
            {channels.map(c => (
              <tr key={c}>
                <td>
                  <div className="row-h" style={{ gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: ['TV','Radio','OOH','Print','Cinema','Trade promo','Sampling'].includes(c) ? 'var(--amber)' : 'var(--sky)' }} />
                    <span style={{ fontWeight: 600 }}>{c}</span>
                  </div>
                </td>
                <td>
                  <div className="row-h" style={{ gap: 4, flexWrap: 'wrap' }}>
                    {METHOD_OPTIONS.map(m => (
                      <button key={m}
                        onClick={() => setMethod(c, m)}
                        style={{
                          padding: '4px 9px', borderRadius: 999, fontSize: 11,
                          fontFamily: 'var(--f-mono)', letterSpacing: '0.04em',
                          border: '1px solid ' + (form.methods[c] === m ? 'var(--blue)' : 'var(--line)'),
                          background: form.methods[c] === m ? 'rgba(79,110,242,0.10)' : 'transparent',
                          color: form.methods[c] === m ? 'var(--text)' : 'var(--dim)',
                          cursor: 'pointer',
                        }}>
                        {m}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={2} style={{ background: 'var(--panel3)' }}>
                <div className="row-h" style={{ gap: 10, justifyContent: 'space-between' }}>
                  <span className="dim" style={{ fontSize: 12 }}>Business outcomes (revenue, conversions) and controls (price, promos, weather) are auto-set to <strong style={{ color: 'var(--text)' }}>Warehouse · auto</strong>.</span>
                  <Tag kind="mint">+ 9 auto-configured</Tag>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Step 5 — Engagement

const StepEngagement = ({ form, setForm }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="display" style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Engagement &amp; infrastructure</div>
        <div className="dim" style={{ fontSize: 12.5 }}>Commercial terms, refresh cadence, and where this client's data lives.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="field">
          <label>Engagement value (per year)</label>
          <div className="row-h" style={{ gap: 8 }}>
            <span className="mono dim" style={{ minWidth: 36, fontSize: 12 }}>{form.currency}</span>
            <input className="input mono" placeholder="54,000" value={form.engagementValue}
              onChange={e => setForm({ ...form, engagementValue: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Contract term</label>
          <select className="input" value={form.termMonths} onChange={e => setForm({ ...form, termMonths: e.target.value })}>
            {[6, 12, 18, 24, 36].map(n => <option key={n} value={n}>{n} months</option>)}
          </select>
        </div>
        <div className="field">
          <label>Model refresh cadence</label>
          <div className="seg">
            {['Monthly','Quarterly','Bi-weekly'].map(c => (
              <button key={c} className={form.cadence === c ? 'on' : ''} onClick={() => setForm({ ...form, cadence: c })}>{c}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Data residency</label>
          <select className="input mono" value={form.residency} onChange={e => setForm({ ...form, residency: e.target.value })}>
            {['asia-southeast1 (Singapore)','asia-southeast2 (Jakarta)','australia-southeast1 (Sydney)','europe-west2 (London)','us-east1 (S. Carolina)'].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>GCP project ID</label>
          <input className="input mono" placeholder="trifecta-<client>-prod"
            value={form.gcpProject} onChange={e => setForm({ ...form, gcpProject: e.target.value })} />
          <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>Each client lives in an isolated GCP project — its own BigQuery dataset, GCS bucket, and service account.</div>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Step 6 — Review

const StepReview = ({ form, goTo }) => {
  const channels = Object.keys(form.channels).filter(c => form.channels[c]);
  const apiCount = channels.filter(c => form.methods[c] === 'API').length;
  const nonApi = channels.length - apiCount;
  const readiness = Math.min(100, Math.round(20 + (apiCount / Math.max(1, channels.length)) * 50));

  const rows = [
    ['Display name',    form.displayName || '—'],
    ['Legal name',      form.legalName || '—'],
    ['Industry',        form.industry],
    ['Geography',       form.region],
    ['KPI',             `${form.kpi} (${form.currency})`],
    ['Primary contact', form.contactName ? `${form.contactName} · ${form.contactEmail}` : '—'],
  ];
  const eng = [
    ['Template',        TRIFECTA_DATA.modelLibrary.find(t => t.id === form.templateId)?.name || (form.templateId === 'blank' ? 'Start from blank' : '—')],
    ['Channels',        `${channels.length} included (${apiCount} API · ${nonApi} non-API)`],
    ['Cadence',         form.cadence],
    ['Engagement',      `${form.currency} ${form.engagementValue || '—'} / yr · ${form.termMonths} mo`],
    ['Residency',       form.residency],
    ['GCP project',     form.gcpProject || '—'],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="display" style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Review &amp; create</div>
        <div className="dim" style={{ fontSize: 12.5 }}>This sets up the GCP project, copies the template into a draft model, and queues the first data-source uploads.</div>
      </div>

      <div className="grid g2">
        <Card>
          <CardHead title="Client" actions={<Btn small kind="ghost" onClick={() => goTo(0)}>Edit</Btn>} />
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map(([k, v]) => (
              <div key={k} className="between" style={{ gap: 12 }}>
                <span className="mono faint" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{k}</span>
                <span style={{ fontSize: 13, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHead title="Model & infrastructure" actions={<Btn small kind="ghost" onClick={() => goTo(1)}>Edit</Btn>} />
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {eng.map(([k, v]) => (
              <div key={k} className="between" style={{ gap: 12 }}>
                <span className="mono faint" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{k}</span>
                <span style={{ fontSize: 13, textAlign: 'right' }} className={k === 'GCP project' || k === 'Residency' ? 'mono' : ''}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="Channels & methods" actions={<Btn small kind="ghost" onClick={() => goTo(2)}>Edit</Btn>} />
        <div className="card-pad" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {channels.map(c => (
            <div key={c} className="row-h" style={{ gap: 6, padding: '4px 8px 4px 4px', background: 'var(--panel3)', border: '1px solid var(--line)', borderRadius: 999 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: ['TV','Radio','OOH','Print','Cinema','Trade promo','Sampling'].includes(c) ? 'var(--amber)' : 'var(--sky)' }} />
              <span style={{ fontSize: 12 }}>{c}</span>
              <Tag kind={form.methods[c] === 'API' ? 'sky' : (form.methods[c] === 'Warehouse' ? 'mint' : (form.methods[c] === 'Feed' ? 'blue' : 'amber'))}>{form.methods[c]}</Tag>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead title="What happens next" />
        <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['1', 'Provision GCP project',      `${form.gcpProject || 'trifecta-<client>-prod'} · BigQuery + GCS + service account`],
            ['2', 'Clone model template',       'New draft Aeon-style model with template priors, ready to tune'],
            ['3', 'Request first uploads',      `${nonApi} non-API sources will need a first spreadsheet to set the column-mapping recipe`],
            ['4', 'Invite client viewer',       `Email ${form.contactEmail || 'primary contact'} a Signal Viewer invite once the first run completes`],
          ].map(([n, t, s]) => (
            <div key={n} className="row-h" style={{ gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--panel3)', border: '1px solid var(--line2)', display: 'grid', placeItems: 'center', fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--dim)', flex: '0 0 22px' }}>{n}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t}</div>
                <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>{s}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="row-h" style={{ gap: 12, alignItems: 'center', padding: '12px 14px', background: 'rgba(55,211,155,0.08)', border: '1px solid rgba(55,211,155,0.35)', borderRadius: 8 }}>
        <span style={{ color: 'var(--mint)' }}><I.Check size={14} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>Initial readiness ~{readiness}%</div>
          <div className="dim" style={{ fontSize: 12 }}>
            {apiCount} channel{apiCount !== 1 ? 's' : ''} will populate automatically once OAuth is connected. {nonApi} source{nonApi !== 1 ? 's' : ''} need the first manual file to set up the mapping recipe.
          </div>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Wizard shell

const AddClientWizard = ({ onClose, onCreate }) => {
  const [step, setStep] = React.useState(0);
  const [form, setForm] = React.useState({
    displayName: '',
    legalName: '',
    industry: 'Beauty & Personal Care',
    region: 'Singapore',
    kpi: 'Revenue',
    currency: 'SGD',
    contactName: '',
    contactEmail: '',
    templateId: 'dtc',
    channels: {},
    methods: {},
    engagementValue: '54,000',
    cadence: 'Monthly',
    termMonths: 12,
    residency: 'asia-southeast1 (Singapore)',
    gcpProject: 'trifecta-<client>-prod',
  });

  const goNext = () => setStep(s => Math.min(WIZ_STEPS.length - 1, s + 1));
  const goBack = () => setStep(s => Math.max(0, s - 1));
  const goTo = (i) => setStep(i);

  const isLast = step === WIZ_STEPS.length - 1;
  const isFirst = step === 0;

  // Validation per step (loose — just disable Next if obviously empty on key steps)
  const canContinue = (() => {
    if (step === 0) return form.displayName.trim().length > 0;
    if (step === 2) return Object.values(form.channels).some(Boolean);
    return true;
  })();

  const handleCreate = () => {
    const channels = Object.keys(form.channels).filter(c => form.channels[c]);
    const apiCount = channels.filter(c => form.methods[c] === 'API').length;
    const readiness = Math.min(100, Math.round(20 + (apiCount / Math.max(1, channels.length)) * 50));
    onCreate({
      id: slug(form.displayName) || ('client-' + Date.now()),
      name: form.displayName || 'New client',
      readiness,
      data_residency: (form.residency || '').split(' ')[0] || 'asia-southeast1',
      version: 'v0',
      state: 'draft',
      run: 'Onboarding',
      actions: channels.length - apiCount,
      status: 'Onboarding',
      steps: { data: 'active', config: 'pending', train: 'pending', results: 'pending', signal: 'pending' },
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--panel3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--sky)' }}>
            <I.Plus size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="display" style={{ fontWeight: 700, fontSize: 16 }}>Add a client</div>
            <div className="dim" style={{ fontSize: 12 }}>Set up the workspace, model template and data sources for a new engagement.</div>
          </div>
          <button className="theme-toggle" onClick={onClose} title="Close">
            <I.Plus size={14} style={{ transform: 'rotate(45deg)' }} />
          </button>
        </div>

        <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--line)', background: 'var(--panel3)' }}>
          <Stepper step={step} />
        </div>

        <div className="modal-body" style={{ minHeight: 380 }}>
          {step === 0 && <StepClient    form={form} setForm={setForm} />}
          {step === 1 && <StepTemplate  form={form} setForm={setForm} />}
          {step === 2 && <StepChannels  form={form} setForm={setForm} />}
          {step === 3 && <StepSources   form={form} setForm={setForm} />}
          {step === 4 && <StepEngagement form={form} setForm={setForm} />}
          {step === 5 && <StepReview    form={form} goTo={goTo} />}
        </div>

        <div className="modal-foot">
          <div className="mono faint" style={{ fontSize: 11, letterSpacing: '0.1em' }}>
            STEP {step + 1} OF {WIZ_STEPS.length} · {WIZ_STEPS[step].label.toUpperCase()}
          </div>
          <div className="row-h" style={{ gap: 8 }}>
            <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
            {!isFirst ? <Btn kind="ghost" onClick={goBack}>Back</Btn> : null}
            {!isLast ? (
              <Btn kind="primary" onClick={canContinue ? goNext : undefined}
                style={canContinue ? {} : { opacity: 0.5, cursor: 'not-allowed' }}>
                Continue
              </Btn>
            ) : (
              <Btn kind="primary" leftIcon={<I.Check size={13} />} onClick={handleCreate}>
                Create client
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


// ============================== app.jsx ==============================
// Top-level app: sidebar, top bar, routing.

const SCREEN_META = {
  'dashboard':     { title: 'Dashboard',        desc: 'Portfolio of clients — model status, readiness and open actions across the practice.' },
  'library':       { title: 'Model Library',    desc: 'Reusable model archetypes — channel sets, priors and adstock defaults.' },
  'pipeline':      { title: 'Data Pipeline',    desc: 'Connect, harmonise and QA every source feeding this client’s model.' },
  'model-studio':  { title: 'Model Studio',     desc: 'Configure the brand-specific MMM — channels, priors, calibration, versions.' },
  'training':      { title: 'Training Runs',    desc: 'Trigger Meridian training on Vertex AI and review run diagnostics.' },
  'results':       { title: 'Results',          desc: 'Read the latest posterior — contribution, ROI, response curves, optimiser.' },
  'reports':       { title: 'Reports',          desc: 'Quarterly & annual client reports — drafted from the model, edited by you, sent by email.' },
  'signal':        { title: 'Signal',           desc: 'Configure the client-facing conversational decision layer.' },
  'client-settings':{ title: 'Client Settings', desc: 'Engagement value, refresh cadence, residency and client users.' },
  'system':        { title: 'Settings',         desc: 'Workspace team, authentication, infrastructure and billing.' },
};

const NAV = {
  workspace: [
    { id: 'dashboard', label: 'Dashboard',     icon: 'Grid' },
    { id: 'library',   label: 'Model Library', icon: 'Layers' },
  ],
  client: [
    { id: 'pipeline',        label: 'Data Pipeline',   icon: 'Database' },
    { id: 'model-studio',    label: 'Model Studio',    icon: 'Sliders' },
    { id: 'training',        label: 'Training Runs',   icon: 'Cpu' },
    { id: 'results',         label: 'Results',         icon: 'Chart' },
    { id: 'reports',         label: 'Reports',         icon: 'FileText' },
    { id: 'signal',          label: 'Signal',          icon: 'Signal' },
    { id: 'client-settings', label: 'Client Settings', icon: 'Settings2' },
  ],
  system: [
    { id: 'system', label: 'Settings', icon: 'Cog' },
  ],
};

// Which surfaces each of the four user types (brief v4.0 §3b) may reach, and where
// they land on sign-in. RLS scopes WHICH clients they see; this scopes WHICH screens.
// `signalOnly` collapses the whole console to the standalone CMO Signal surface.
const ALL_SCREENS = ['dashboard','library','pipeline','model-studio','training','results','reports','signal','client-settings','system'];
const ACCESS = {
  in_house:      { screens: ALL_SCREENS, home: 'dashboard' },
  expert:        { screens: ['dashboard','library','pipeline','model-studio','training','results','reports','signal'], home: 'dashboard' },
  client_upload: { screens: ['pipeline','results','signal'], home: 'pipeline' },
  client_signal: { screens: ['signal'], home: 'signal', signalOnly: true },
};
const accessFor = (role) => ACCESS[role] || ACCESS.in_house;

const Sidebar = ({ screen, go, activeClient, clients, setActiveClient, allowed, userEmail }) => {
  const [open, setOpen] = React.useState(false);
  const can = (id) => !allowed || allowed.includes(id);
  const ws = NAV.workspace.filter(n => can(n.id));
  const cl = NAV.client.filter(n => can(n.id));
  const sy = NAV.system.filter(n => can(n.id));
  const NavItem = ({ item }) => {
    const Ic = I[item.icon] || I.Grid;
    return (
      <div className={'nav-item' + (screen === item.id ? ' active' : '')} onClick={() => go(item.id)}>
        <span className="ic"><Ic size={15} /></span>
        <span>{item.label}</span>
      </div>
    );
  };
  return (
    <aside className="sidebar">
      <div className="brand">
        <Logo size={22} />
        <div className="brand-lockup">
          <span className="wordmark">TRIFECTA</span>
          <span className="partof-mini">Part of <b>Midpoint Global</b></span>
        </div>
      </div>
      <div className="scroll">
        {ws.length ? (
          <>
            <div className="group-label">WORKSPACE</div>
            {ws.map(n => <NavItem key={n.id} item={n} />)}
          </>
        ) : null}

        <div className="group-label" style={{ marginTop: 14 }}>CLIENT</div>
        <div style={{ position: 'relative' }}>
          <div className="client-selector" onClick={() => setOpen(v => !v)}>
            <span className="dot" />
            <div className="name">{activeClient.name}</div>
            <span className="chev" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
              <I.Chevron size={14} />
            </span>
          </div>
          {open ? (
            <div style={{
              position: 'absolute', left: 8, right: 8, top: 'calc(100% + 4px)',
              background: 'var(--panel2)', border: '1px solid var(--line2)', borderRadius: 8,
              zIndex: 10, padding: 4, boxShadow: '0 12px 30px rgba(0,0,0,0.5)'
            }}>
              {clients.map(c => (
                <div key={c.id}
                  onClick={() => { setActiveClient(c.id); setOpen(false); }}
                  style={{
                    padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                    background: c.id === activeClient.id ? 'rgba(79,110,242,0.10)' : 'transparent',
                    fontSize: 12.5,
                  }}>
                  <div className="between">
                    <span>{c.name}</span>
                    <span className="mono faint" style={{ fontSize: 10.5 }}>{c.version}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {cl.map(n => <NavItem key={n.id} item={n} />)}

        {sy.length ? (
          <>
            <div className="group-label" style={{ marginTop: 14 }}>SYSTEM</div>
            {sy.map(n => <NavItem key={n.id} item={n} />)}
          </>
        ) : null}
      </div>
      <div className="signout" onClick={() => go('__signout')}>
        <I.LogOut size={14} />
        <span style={{ flex: 1, fontSize: 11.5 }} className="mono">{userEmail || 'rajeev@trifecta.sg'}</span>
      </div>
    </aside>
  );
};

const ThemeToggle = ({ theme, setTheme, style }) => (
  <button
    className="theme-toggle"
    style={style}
    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    aria-label="Toggle theme"
  >
    {theme === 'dark' ? <I.Sun size={14} /> : <I.Moon size={14} />}
  </button>
);

const TopBar = ({ screen, activeClient, theme, setTheme }) => {
  const meta = SCREEN_META[screen] || { title: 'Trifecta', desc: '' };
  const isClientScope = ['pipeline','model-studio','training','results','reports','signal','client-settings'].includes(screen);
  return (
    <div className="topbar">
      <div>
        <div className="row-h" style={{ gap: 10 }}>
          {isClientScope ? (
            <>
              <span className="mono faint" style={{ fontSize: 11, letterSpacing: '0.12em' }}>{activeClient.name.toUpperCase()}</span>
              <span className="faint">/</span>
            </>
          ) : null}
          <h1>{meta.title}</h1>
        </div>
        <div className="desc">{meta.desc}</div>
      </div>
      <div className="right">
        <div className="row-h faint mono" style={{ gap: 8, fontSize: 11.5 }}>
          <I.Search size={13} /> Quick find
        </div>
        <span className="wf-badge">PHASE 0 · DEMO</span>
        <ThemeToggle theme={theme} setTheme={setTheme} />
        <div style={{ width: 30, height: 30, borderRadius: 999, background: 'var(--panel2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--sky)' }} className="mono">
          RB
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------

// Map tenant-scoped DB client rows → the shape the console UI expects, merging
// the Phase 0 demo detail (lifecycle steps) by slug for visual continuity.
function mapDbClients(rows) {
  const bySlug = Object.fromEntries(TRIFECTA_DATA.clients.map(c => [c.id, c]));
  return rows.map(r => {
    const demo = bySlug[r.slug] || {};
    return {
      id: r.slug,
      dbId: r.id,        // real client UUID — needed by the ingestion/admin APIs
      name: r.name,
      readiness: r.readiness ?? demo.readiness ?? 0,
      version: r.version || demo.version || 'v1',
      state: r.state || demo.state || 'draft',
      run: r.run_label || demo.run || '',
      actions: r.actions ?? demo.actions ?? 0,
      status: r.status || demo.status || 'Onboarding',
      steps: demo.steps || { data: 'active', config: 'pending', train: 'pending', results: 'pending', signal: 'pending' },
    };
  });
}

// Type-4 (CMO / decision-maker) surface: the standalone Signal chat, scoped to the
// client's live model, with no path to any other console screen. The full CMO
// product (persistent history, share-as-image, freshness) lands in M6; this M1 shell
// guarantees the isolation — a Type-4 user simply cannot reach anything else.
function CMOSignalShell({ client, email, theme, setTheme, onSignOut }) {
  return (
    <div className="cmo-shell" style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
        <Logo size={22} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span className="wordmark" style={{ fontWeight: 700, letterSpacing: '0.08em' }}>SIGNAL</span>
          <span className="faint mono" style={{ fontSize: 10 }}>{client?.name || ''}</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <ThemeToggle theme={theme} setTheme={setTheme} />
          {email ? <span className="faint mono" style={{ fontSize: 11 }}>{email}</span> : null}
          <button className="btn ghost small" onClick={onSignOut}>Sign out</button>
        </div>
      </header>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: 18 }}>
        <div style={{ width: '100%', maxWidth: 880 }}>
          <SignalChat client={client} />
        </div>
      </div>
    </div>
  );
}

function App() {
  const [authed, setAuthed] = React.useState(false);
  const [authReady, setAuthReady] = React.useState(!isSupabaseConfigured());
  // userType drives which surfaces are reachable. With Supabase unconfigured (the
  // Phase 0 demo fallback) we treat the session as an in_house operator so the full
  // console renders; with Supabase on, it stays null until the profile loads.
  const [userRole, setUserRole] = React.useState(isSupabaseConfigured() ? null : 'in_house');
  const [userEmail, setUserEmail] = React.useState(null);
  const [screen, setScreen] = React.useState('dashboard');
  const [activeClientId, setActiveClientId] = React.useState(TRIFECTA_DATA.activeClientId);
  const [theme, setTheme] = React.useState('light');
  const [clients, setClients] = React.useState(TRIFECTA_DATA.clients);
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Determine the initial session and subscribe to auth changes (Supabase only).
  React.useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) { setAuthReady(true); return; }
    let mounted = true;
    sb.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setAuthed(!!data.session);
      setAuthReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setAuthed(!!session);
      if (session) setScreen('dashboard');
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  // Fetch the RLS-scoped client portfolio; reused on load and after creating a client.
  const loadClients = React.useCallback(async () => {
    const sb = getSupabaseBrowser();
    if (!sb) return null;
    const { data, error } = await sb.from('clients').select('*').order('created_at', { ascending: true });
    if (error || !data || !data.length) return null;
    const mapped = mapDbClients(data);
    setClients(mapped);
    return mapped;
  }, []);

  // Load the signed-in user's profile (role → surface access) and the portfolio
  // they're allowed to see (RLS-scoped). Both are scoped server-side by RLS.
  React.useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!authed || !sb) return;
    let mounted = true;
    sb.auth.getUser().then(({ data: u }) => {
      if (!mounted || !u?.user) return;
      setUserEmail(u.user.email || null);
      sb.from('users').select('role, email').eq('id', u.user.id).single().then(({ data: p }) => {
        if (!mounted) return;
        setUserRole((p && p.role) || 'client_signal');  // unknown profile → least privilege
        if (p && p.email) setUserEmail(p.email);
      });
    });
    loadClients().then((mapped) => {
      if (!mounted || !mapped) return;
      setActiveClientId(prev => (mapped.find(c => c.id === prev) ? prev : mapped[0].id));
    });
    return () => { mounted = false; };
  }, [authed, loadClients]);

  // When the role resolves, land the user on their permitted home surface.
  React.useEffect(() => {
    if (!userRole) return;
    const acc = accessFor(userRole);
    setScreen(s => (acc.screens.includes(s) ? s : acc.home));
  }, [userRole]);

  const activeClient = clients.find(c => c.id === activeClientId) || clients[0];

  const go = (s) => {
    if (s === '__signout') {
      const sb = getSupabaseBrowser();
      if (sb) { sb.auth.signOut(); setUserRole(null); setUserEmail(null); } // listener flips `authed`
      else { setAuthed(false); }      // demo-fallback path
      return;
    }
    // Never navigate to a surface this user type can't reach.
    if (userRole && !accessFor(userRole).screens.includes(s)) return;
    setScreen(s);
    window.scrollTo({ top: 0 });
  };
  const enterClient = (id) => {
    setActiveClientId(id);
    setScreen('model-studio');
    window.scrollTo({ top: 0 });
  };

  const createClient = async (c) => {
    // Persist via the in-house admin API when Supabase is live; the wizard payload
    // carries { name, readiness, data_residency }.
    if (isSupabaseConfigured()) {
      try {
        const res = await fetch('/api/admin/clients', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: c.name, readiness: c.readiness, data_residency: c.data_residency }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
        await loadClients();
        setAdding(false);
        if (j.client?.slug) setActiveClientId(j.client.slug);
        setScreen('pipeline');
        window.scrollTo({ top: 0 });
      } catch (e) {
        alert('Could not create client: ' + e.message);
      }
      return;
    }
    // Demo fallback (no Supabase): keep it local.
    let id = c.id || slug(c.name) || ('client-' + Date.now());
    if (clients.find(x => x.id === id)) id = id + '-' + (clients.length + 1);
    const next = { ...c, id };
    setClients([...clients, next]);
    setActiveClientId(id);
    setAdding(false);
    setScreen('pipeline');
    window.scrollTo({ top: 0 });
  };

  // Avoid flashing the Login screen before the initial session check resolves.
  if (!authReady) {
    return <div className="login-bg" />;
  }

  if (!authed) {
    return (
      <>
        <Login onSignIn={() => { setAuthed(true); setScreen('dashboard'); }} />
        <ThemeToggle
          theme={theme}
          setTheme={setTheme}
          style={{ position: 'fixed', top: 20, right: 20, zIndex: 20 }}
        />
      </>
    );
  }

  // Authed but role not yet resolved (Supabase on): hold a splash so no console
  // surface flashes before we know the user type (matters most for a Type-4 CMO).
  if (isSupabaseConfigured() && !userRole) {
    return <div className="login-bg" />;
  }

  const acc = accessFor(userRole);
  const allowed = acc.screens;
  const safeScreen = allowed.includes(screen) ? screen : acc.home;

  // Type 4 (CMO / decision-maker): the standalone Signal surface, nothing else.
  if (acc.signalOnly) {
    return (
      <CMOSignalShell
        client={activeClient}
        email={userEmail}
        theme={theme}
        setTheme={setTheme}
        onSignOut={() => go('__signout')}
      />
    );
  }

  let body = null;
  switch (safeScreen) {
    case 'dashboard':     body = <Dashboard go={go} enterClient={enterClient} clients={clients} openAddClient={() => setAdding(true)} />; break;
    case 'library':       body = <ModelLibrary go={go} />; break;
    case 'pipeline':      body = <DataPipelineLive client={activeClient} />; break;
    case 'model-studio':  body = <ModelStudio client={activeClient} />; break;
    case 'training':      body = <TrainingRunsLive client={activeClient} />; break;
    case 'results':       body = <ResultsLive client={activeClient} />; break;
    case 'reports':       body = <ReportsScreen client={activeClient} />; break;
    case 'signal':        body = <SignalChat client={activeClient} />; break;
    case 'client-settings': body = <ClientSettings client={activeClient} />; break;
    case 'system':        body = <SystemSettings />; break;
    default:              body = <Dashboard go={go} enterClient={enterClient} clients={clients} openAddClient={() => setAdding(true)} />;
  }

  return (
    <div id="app">
      <Sidebar
        screen={safeScreen}
        go={go}
        activeClient={activeClient}
        clients={clients}
        setActiveClient={setActiveClientId}
        allowed={allowed}
        userEmail={userEmail}
      />
      <main className="main">
        <TopBar screen={safeScreen} activeClient={activeClient} theme={theme} setTheme={setTheme} />
        <div className="content" data-screen-label={`${SCREEN_META[safeScreen]?.title}`}>{body}</div>
        <div className="footer-note">TRIFECTA PLATFORM · PHASE 0 DEMO · GENUINE MERIDIAN OUTPUTS ON FICTIONAL DEMO DATA</div>
      </main>
      {adding ? <AddClientWizard onClose={() => setAdding(false)} onCreate={createClient} /> : null}
    </div>
  );
}


export default App;
