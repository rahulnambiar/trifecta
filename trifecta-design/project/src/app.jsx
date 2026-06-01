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

const Sidebar = ({ screen, go, activeClient, clients, setActiveClient }) => {
  const [open, setOpen] = React.useState(false);
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
        <div className="group-label">WORKSPACE</div>
        {NAV.workspace.map(n => <NavItem key={n.id} item={n} />)}

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
        {NAV.client.map(n => <NavItem key={n.id} item={n} />)}

        <div className="group-label" style={{ marginTop: 14 }}>SYSTEM</div>
        {NAV.system.map(n => <NavItem key={n.id} item={n} />)}
      </div>
      <div className="signout" onClick={() => go('__signout')}>
        <I.LogOut size={14} />
        <span style={{ flex: 1, fontSize: 11.5 }} className="mono">rajeev@trifecta.sg</span>
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
        <span className="wf-badge">WIREFRAME · v1.0</span>
        <ThemeToggle theme={theme} setTheme={setTheme} />
        <div style={{ width: 30, height: 30, borderRadius: 999, background: 'var(--panel2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--sky)' }} className="mono">
          RB
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------

function App() {
  const [authed, setAuthed] = React.useState(false);
  const [screen, setScreen] = React.useState('dashboard');
  const [activeClientId, setActiveClientId] = React.useState(TRIFECTA_DATA.activeClientId);
  const [theme, setTheme] = React.useState('light');
  const [clients, setClients] = React.useState(TRIFECTA_DATA.clients);
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const activeClient = clients.find(c => c.id === activeClientId) || clients[0];

  const go = (s) => {
    if (s === '__signout') { setAuthed(false); return; }
    setScreen(s);
    window.scrollTo({ top: 0 });
  };
  const enterClient = (id) => {
    setActiveClientId(id);
    setScreen('model-studio');
    window.scrollTo({ top: 0 });
  };

  const createClient = (c) => {
    // Avoid id collisions
    let id = c.id;
    if (clients.find(x => x.id === id)) id = id + '-' + (clients.length + 1);
    const next = { ...c, id };
    setClients([...clients, next]);
    setActiveClientId(id);
    setAdding(false);
    setScreen('pipeline');
    window.scrollTo({ top: 0 });
  };

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

  let body = null;
  switch (screen) {
    case 'dashboard':     body = <Dashboard go={go} enterClient={enterClient} clients={clients} openAddClient={() => setAdding(true)} />; break;
    case 'library':       body = <ModelLibrary go={go} />; break;
    case 'pipeline':      body = <DataPipeline client={activeClient} />; break;
    case 'model-studio':  body = <ModelStudio client={activeClient} />; break;
    case 'training':      body = <TrainingRuns client={activeClient} />; break;
    case 'results':       body = <Results client={activeClient} />; break;
    case 'reports':       body = <ReportsScreen client={activeClient} />; break;
    case 'signal':        body = <SignalScreen client={activeClient} />; break;
    case 'client-settings': body = <ClientSettings client={activeClient} />; break;
    case 'system':        body = <SystemSettings />; break;
    default:              body = <Dashboard go={go} enterClient={enterClient} clients={clients} openAddClient={() => setAdding(true)} />;
  }

  return (
    <div id="app">
      <Sidebar
        screen={screen}
        go={go}
        activeClient={activeClient}
        clients={clients}
        setActiveClient={setActiveClientId}
      />
      <main className="main">
        <TopBar screen={screen} activeClient={activeClient} theme={theme} setTheme={setTheme} />
        <div className="content" data-screen-label={`${SCREEN_META[screen]?.title}`}>{body}</div>
        <div className="footer-note">DESIGN BLUEPRINT · NAVIGABLE WIREFRAME · FICTIONAL DATA</div>
      </main>
      {adding ? <AddClientWizard onClose={() => setAdding(false)} onCreate={createClient} /> : null}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
