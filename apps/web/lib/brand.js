'use client';
// White-label branding. The tenant is derived from the URL path: platform.trifecta.sg
// serves the default Trifecta brand; platform.trifecta.sg/neugenm serves the NeuGenM
// distributor white-label (their logo + name, no Trifecta/Midpoint marks). UI only —
// same models, same data, same accounts.
import React from 'react';

export const BRANDS = {
  trifecta: {
    key: 'trifecta',
    name: 'Trifecta',
    logoSrc: null, // uses the built-in .logomark + TRIFECTA wordmark
    eyebrow: 'Part of Midpoint Global',
    poweredBy: 'Powered by Claude + the Trifecta MCP server · genuine Meridian outputs · fictional demo data.',
  },
  neugenm: {
    key: 'neugenm',
    name: 'NeuGenM',
    logoSrc: '/neugenm-logo.svg',
    eyebrow: null,
    poweredBy: 'Powered by Trifecta · model-grounded answers · demo data.',
  },
};

export const BrandContext = React.createContext(BRANDS.trifecta);
export const useBrand = () => React.useContext(BrandContext);
export function brandFromPath(pathname) {
  return (pathname || '').startsWith('/neugenm') ? BRANDS.neugenm : BRANDS.trifecta;
}
