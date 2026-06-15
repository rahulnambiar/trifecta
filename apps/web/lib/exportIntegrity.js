// Export-integrity rule — Phase 1 brief v4.0 §2: "uncertainty travels with the number."
//
// Every chart and every export (image / CSV / PDF / Excel) must carry three things:
//   1. the credible interval,
//   2. the as-of date (when the live model was generated),
//   3. the model version.
// A number must never escape its context. This module is the single chokepoint that
// enforces that rule, so no surface can quietly ship a bare point estimate.
//
// Pure and framework-free (no React) so it is unit-tested in isolation
// (exportIntegrity.test.mjs) — test area #4 in the brief (§9): a test must fail if any
// export omits interval / as-of / version.

export class ExportIntegrityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ExportIntegrityError';
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ISO timestamp → "01 Jun 2026" (UTC, stable across timezones). Null if unparseable.
export function formatAsOf(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// 0.9 → "90% CI". Null unless a probability strictly inside (0, 1).
export function ciLabel(confidenceLevel) {
  if (typeof confidenceLevel !== 'number' || !(confidenceLevel > 0 && confidenceLevel < 1)) return null;
  return `${Math.round(confidenceLevel * 100)}% CI`;
}

// Throws unless the provenance carries all three required parts. The guard the whole
// rule rests on — every export path calls this before emitting anything.
export function assertProvenance(p) {
  const prov = p || {};
  const missing = [];
  if (!prov.modelVersion || typeof prov.modelVersion !== 'string') missing.push('modelVersion');
  if (!formatAsOf(prov.asOf)) missing.push('asOf');
  if (ciLabel(prov.confidenceLevel) == null) missing.push('confidenceLevel');
  if (missing.length) {
    throw new ExportIntegrityError(
      `export blocked — missing required provenance: ${missing.join(', ')} ` +
      `(uncertainty must travel with the number)`
    );
  }
  return true;
}

// Detect whether a (possibly nested) data row carries a credible interval — either
// flat keys (…ci_lo / …ci_hi / lower / upper) or a nested {ci_lo, ci_hi} object.
export function rowHasInterval(row) {
  if (!row || typeof row !== 'object') return false;
  for (const [k, v] of Object.entries(row)) {
    if (v == null) continue;
    if (/(?:^|[._])(?:ci_?lo|ci_?hi|lower|upper)$/i.test(k)) return true;
    if (typeof v === 'object') {
      if (('ci_lo' in v && 'ci_hi' in v) || ('lo' in v && 'hi' in v) || ('lower' in v && 'upper' in v)) return true;
      if (rowHasInterval(v)) return true;
    }
  }
  return false;
}

// Posterior-estimate exports must carry an interval on at least one row. (Pure
// diagnostics — e.g. model health — are exempt via requireInterval=false.)
export function assertRowsCarryInterval(rows) {
  if (!Array.isArray(rows) || rows.length === 0 || !rows.some(rowHasInterval)) {
    throw new ExportIntegrityError(
      'export blocked — posterior estimates carry no credible interval'
    );
  }
  return true;
}

// One-line stamp for on-screen captions: "90% CI · as of 01 Jun 2026 · model Aeon · v3".
export function provenanceCaption(p) {
  const prov = p || {};
  return [
    ciLabel(prov.confidenceLevel),
    formatAsOf(prov.asOf) ? `as of ${formatAsOf(prov.asOf)}` : null,
    prov.modelVersion ? `model ${prov.modelVersion}` : null,
  ].filter(Boolean).join(' · ');
}

// CSV with a provenance header block prepended. Asserts provenance first; if the rows
// are posterior estimates (requireInterval), asserts they carry an interval too.
export function toProvenancedCSV(csv, p, { rows, requireInterval = true } = {}) {
  assertProvenance(p);
  if (requireInterval && rows) assertRowsCarryInterval(rows);
  const header = [
    '# Trifecta — Signal export',
    `# Model version: ${p.modelVersion}`,
    `# As of: ${formatAsOf(p.asOf)} (${p.asOf})`,
    `# Uncertainty: ${ciLabel(p.confidenceLevel)} — lower/upper bounds carried in the *_ci_lo / *_ci_hi columns`,
    '# Uncertainty travels with the number — do not quote a figure without its interval.',
  ].join('\n');
  return `${header}\n${csv}`;
}

// JSON wrapped with a _provenance block. Asserts provenance first.
export function toProvenancedJSON(data, p) {
  assertProvenance(p);
  return JSON.stringify({
    _provenance: {
      modelVersion: p.modelVersion,
      asOf: p.asOf,
      asOfLabel: formatAsOf(p.asOf),
      confidenceLevel: p.confidenceLevel,
      ciLabel: ciLabel(p.confidenceLevel),
      note: 'Uncertainty travels with the number — figures carry a credible interval.',
    },
    data,
  }, null, 2);
}
