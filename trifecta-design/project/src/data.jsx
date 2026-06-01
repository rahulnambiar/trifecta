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

window.TRIFECTA_DATA = TRIFECTA_DATA;
